// POST multipart upload — R2 + PDF extract + optional auto-advance / CRL fill.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { getDocsBucket, objectKey } from "@/lib/storage";
import { extractPdfText } from "@/lib/pdf/extract";
import { extractDocument } from "@/lib/ai";
import { isAutonomyOn } from "@/lib/autonomy";
import {
  applyProcurementAdvance,
  matchExtractToOrders,
} from "@/lib/procure-match";
import { maybeFireGate } from "@/lib/status-machine";
import { applyCrlQuoteExtract } from "@/lib/crl-quote-fill";

function typeFromName(name: string) {
  const lower = name.toLowerCase();
  if (/\.(png|jpe?g|gif|webp)$/.test(lower)) return "photo";
  if (/\.pdf$/.test(lower)) return "other";
  return "other";
}

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const projectId = String(form.get("project_id") || "");
  if (!(file instanceof File) || !projectId) {
    return NextResponse.json({ error: "file and project_id are required." }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  const size = file.size;
  const fileName = file.name || "upload";
  const docType = String(form.get("type") || typeFromName(fileName));

  try {
    const doc = await withUser(session, async (c) => {
      const proj = await c.query(`SELECT id FROM projects WHERE id = $1`, [projectId]);
      if (!proj.rows[0]) throw new Error("Project not found.");
      const { rows } = await c.query(
        `INSERT INTO documents (company_id, file, type, mime, size, project_id, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'upload') RETURNING *`,
        [session.companyId, fileName, docType, mime, size, projectId],
      );
      return rows[0];
    });

    const bucket = await getDocsBucket();
    const key = objectKey(session.companyId, doc.id, fileName);
    const buf = new Uint8Array(await file.arrayBuffer());
    await bucket.put(key, buf, { httpMetadata: { contentType: mime } });

    if (mime === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
      const text = await extractPdfText(buf);
      const extracted = await extractDocument(text);
      if (extracted) {
        await withUser(session, async (c) => {
          await c.query(`UPDATE documents SET extracted = $2::jsonb WHERE id = $1`, [
            doc.id,
            JSON.stringify(extracted),
          ]);
          await c.query(
            `INSERT INTO ai_runs (company_id, kind, model, input, output, confidence, document_id, project_id)
             VALUES ($1, 'pdf_extract', $2, $3::jsonb, $4::jsonb, $5, $6, $7)`,
            [
              session.companyId,
              process.env.LLM_MODEL || "heuristic",
              JSON.stringify({ chars: text.length }),
              JSON.stringify(extracted),
              extracted.confidence,
              doc.id,
              projectId,
            ],
          );

          if (
            extracted.quote_number ||
            (extracted.hardware_bom && extracted.hardware_bom.length) ||
            /crl|quote/i.test(fileName)
          ) {
            await applyCrlQuoteExtract(c, session.companyId, doc.id, extracted);
          }

          const { best, alternatives } = await matchExtractToOrders(c, extracted);
          const matchConf = best?.score || 0;
          const autoOk =
            (extracted.confidence || 0) >= 0.9 &&
            matchConf >= 0.9 &&
            (await isAutonomyOn(c, session.companyId, "auto_advance_procurement"));

          if (autoOk && best) {
            const adv = await applyProcurementAdvance(
              c,
              session.companyId,
              extracted,
              best,
              doc.id,
            );
            if (adv.advanced) await maybeFireGate(c, session, best.project_id);
          } else if ((extracted.confidence || 0) < 0.9 || !best || matchConf < 0.9) {
            await c.query(
              `INSERT INTO review_queue_items
                 (company_id, document_id, guessed_project_id, alternatives, extract, confidence, status)
               VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, 'open')`,
              [
                session.companyId,
                doc.id,
                best?.project_id || projectId,
                JSON.stringify(
                  alternatives.length
                    ? alternatives
                    : [{ project_id: projectId, label: "Upload project", score: 0.5, via: "upload" }],
                ),
                JSON.stringify(extracted),
                extracted.confidence,
              ],
            );
          }
        });
        doc.extracted = extracted;
      }
    }

    return NextResponse.json(doc, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed." },
      { status: 400 },
    );
  }
}
