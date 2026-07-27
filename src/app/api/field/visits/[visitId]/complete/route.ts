// Complete a field visit — signature document + visit row + optional install status.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { getDocsBucket, objectKey } from "@/lib/storage";
import { transition } from "@/lib/status-machine";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ visitId: string }> },
) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { visitId } = await params;
  const body = await req.json() as any;
  const projectId = String(body.project_id || "");
  const skip = Boolean(body.skip);
  const skipReason = String(body.skip_reason || "").trim();
  const homeowner = String(body.homeowner_name || "").trim();
  const punchList = Array.isArray(body.punch_list) ? body.punch_list : [];
  const type = String(body.type || "");

  if (!projectId) return NextResponse.json({ error: "project_id required." }, { status: 400 });
  if (skip && !skipReason) {
    return NextResponse.json({ error: "Skip reason required." }, { status: 400 });
  }
  if (!skip && !homeowner) {
    return NextResponse.json({ error: "Homeowner name required." }, { status: 400 });
  }

  try {
    const result = await withUser(session, async (c) => {
      const visit = await c.query(`SELECT * FROM visits WHERE id = $1`, [visitId]);
      if (!visit.rows[0]) throw new Error("Visit not found.");
      if (visit.rows[0].completed_at) throw new Error("Already completed.");

      let signatureDocumentId: string | null = null;
      if (!skip && body.signature_data_url) {
        const dataUrl = String(body.signature_data_url);
        const b64 = dataUrl.split(",")[1];
        if (b64) {
          const buf = Buffer.from(b64, "base64");
          const fileName = `signature-${visitId}.png`;
          const { rows } = await c.query(
            `INSERT INTO documents
               (company_id, file, type, mime, size, project_id, source, signer_name, signed_at)
             VALUES ($1, $2, 'signature', 'image/png', $3, $4, 'field', $5, now())
             RETURNING id`,
            [session.companyId, fileName, buf.length, projectId, homeowner],
          );
          signatureDocumentId = rows[0].id;
          const bucket = await getDocsBucket();
          await bucket.put(objectKey(session.companyId, signatureDocumentId!, fileName), buf, {
            httpMetadata: { contentType: "image/png" },
          });
        }
      } else if (skip) {
        const { rows } = await c.query(
          `INSERT INTO documents
             (company_id, file, type, mime, project_id, source, skip_reason)
           VALUES ($1, 'sign-off-skipped.txt', 'signature', 'text/plain', $2, 'field', $3)
           RETURNING id`,
          [session.companyId, projectId, skipReason],
        );
        signatureDocumentId = rows[0].id;
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
         VALUES ($1, $2, 'field', $3, 'visit_completed', $4::jsonb)`,
        [
          session.companyId,
          projectId,
          session.userId,
          JSON.stringify({
            visit_id: visitId,
            skip,
            homeowner: skip ? null : homeowner,
            punch_list: punchList,
          }),
        ],
      );

      if (type === "install") {
        const proj = await c.query(`SELECT status FROM projects WHERE id = $1`, [projectId]);
        if (proj.rows[0]?.status === "install_scheduled") {
          await transition(c, session, projectId, "installed", {
            kind: "field",
            userId: session.userId,
          });
        }
      }

      return { ok: true, signatureDocumentId };
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Complete failed." },
      { status: 400 },
    );
  }
}
