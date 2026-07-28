// Complete a field visit — photos, signoff/skip, status-machine transitions.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { getDocsBucket, objectKey } from "@/lib/storage";
import { transition } from "@/lib/status-machine";
import { canAccessVisit } from "@/lib/field-access";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ visitId: string }> },
) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { visitId } = await params;

  const form = await req.formData();
  const projectId = String(form.get("project_id") || "");
  const skip = String(form.get("skip") || "") === "1";
  const skipReason = String(form.get("skip_reason") || "").trim();
  const homeowner = String(form.get("homeowner_name") || "").trim();
  const type = String(form.get("type") || "");
  let punchList: string[] = [];
  try {
    punchList = JSON.parse(String(form.get("punch_list") || "[]"));
  } catch {
    punchList = [];
  }
  const signatureDataUrl = form.get("signature_data_url")
    ? String(form.get("signature_data_url"))
    : null;
  const photos = form.getAll("photos").filter((f): f is File => f instanceof File);

  if (!projectId) return NextResponse.json({ error: "project_id required." }, { status: 400 });
  if (skip && !skipReason) {
    return NextResponse.json({ error: "Skip reason required." }, { status: 400 });
  }
  if (!skip && !homeowner) {
    return NextResponse.json({ error: "Homeowner name required." }, { status: 400 });
  }
  if (type === "install" && photos.length === 0 && !skip) {
    return NextResponse.json({ error: "At least one photo required." }, { status: 400 });
  }

  try {
    const result = await withUser(session, async (c) => {
      const allowed = await canAccessVisit(c, {
        role: session.role,
        userId: session.userId,
        visitId,
      });
      if (!allowed) throw new Error("This job is not assigned to you.");

      const visit = await c.query(`SELECT * FROM visits WHERE id = $1`, [visitId]);
      if (!visit.rows[0]) throw new Error("Visit not found.");
      if (visit.rows[0].completed_at) throw new Error("Already completed.");

      const evidenceIds: string[] = [];
      const bucket = await getDocsBucket();

      for (const file of photos) {
        const buf = new Uint8Array(await file.arrayBuffer());
        const fileName = file.name || `field-photo-${Date.now()}.jpg`;
        const { rows } = await c.query(
          `INSERT INTO documents
             (company_id, file, type, mime, size, project_id, source)
           VALUES ($1, $2, 'photo', $3, $4, $5, 'field') RETURNING id`,
          [
            session.companyId,
            fileName,
            file.type || "image/jpeg",
            buf.length,
            projectId,
          ],
        );
        evidenceIds.push(rows[0].id);
        await bucket.put(objectKey(session.companyId, rows[0].id, fileName), buf, {
          httpMetadata: { contentType: file.type || "image/jpeg" },
        });
      }

      let signatureDocumentId: string | null = null;
      if (!skip && signatureDataUrl) {
        const b64 = signatureDataUrl.split(",")[1];
        if (!b64) throw new Error("Invalid signature.");
        const buf = Buffer.from(b64, "base64");
        const fileName = `signoff-${visitId}.png`;
        const { rows } = await c.query(
          `INSERT INTO documents
             (company_id, file, type, mime, size, project_id, source, signer_name, signed_at)
           VALUES ($1, $2, 'signoff', 'image/png', $3, $4, 'field', $5, now())
           RETURNING id`,
          [session.companyId, fileName, buf.length, projectId, homeowner],
        );
        const sigId = rows[0].id as string;
        signatureDocumentId = sigId;
        evidenceIds.push(sigId);
        await bucket.put(objectKey(session.companyId, sigId, fileName), buf, {
          httpMetadata: { contentType: "image/png" },
        });
      } else if (skip) {
        const fileName = "signoff-skipped.txt";
        const body = Buffer.from(`Skipped: ${skipReason}\n`, "utf8");
        const { rows } = await c.query(
          `INSERT INTO documents
             (company_id, file, type, mime, size, project_id, source, skip_reason)
           VALUES ($1, $2, 'signoff', 'text/plain', $3, $4, 'field', $5)
           RETURNING id`,
          [session.companyId, fileName, body.length, projectId, skipReason],
        );
        const sigId = rows[0].id as string;
        signatureDocumentId = sigId;
        evidenceIds.push(sigId);
        await bucket.put(objectKey(session.companyId, sigId, fileName), body, {
          httpMetadata: { contentType: "text/plain" },
        });
      }

      await c.query(
        `UPDATE visits SET
           completed_at = now(),
           punch_list = $2::jsonb,
           complete_note = $3,
           signature_document_id = $4,
           updated_at = now()
         WHERE id = $1`,
        [
          visitId,
          JSON.stringify(punchList),
          skip ? `Skipped: ${skipReason}` : `Signed by ${homeowner}`,
          signatureDocumentId,
        ],
      );

      await c.query(
        `INSERT INTO activity_events (company_id, project_id, actor, actor_user_id, verb, details)
         VALUES ($1, $2, 'field', $3, 'Completed via Field', $4::jsonb)`,
        [
          session.companyId,
          projectId,
          session.userId,
          JSON.stringify({
            visit_id: visitId,
            skip,
            homeowner: skip ? null : homeowner,
            punch_list: punchList,
            evidence_document_ids: evidenceIds,
          }),
        ],
      );

      const proj = await c.query(`SELECT status FROM projects WHERE id = $1`, [projectId]);
      const status = proj.rows[0]?.status as string | undefined;
      if (type === "install" && status === "install_scheduled") {
        await transition(c, session, projectId, "installed", {
          kind: "field",
          userId: session.userId,
        });
      }
      if (type === "measure" && status === "measure_scheduled") {
        await transition(c, session, projectId, "measured", {
          kind: "field",
          userId: session.userId,
        });
      }

      return { ok: true, evidenceIds };
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Complete failed." },
      { status: 400 },
    );
  }
}
