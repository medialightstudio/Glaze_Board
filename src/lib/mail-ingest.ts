// Poll Gmail — fetch attachments to R2, match PO, auto-advance when allowed.

import { withOwnerClient } from "@/lib/db-core";
import {
  collectAttachments,
  getAttachment,
  getMessage,
  labelFiled,
  listRecentMessages,
  refreshAccessToken,
  supplierLooking,
} from "@/lib/gmail";
import { extractPdfText } from "@/lib/pdf/extract";
import { extractDocument } from "@/lib/ai";
import { getDocsBucket, objectKey } from "@/lib/storage";
import { matchTicket } from "@/lib/matching";
import { isAutonomyOn } from "@/lib/autonomy";
import {
  applyProcurementAdvance,
  matchExtractToOrders,
} from "@/lib/procure-match";
import { maybeFireGate } from "@/lib/status-machine";
import { applyCrlQuoteExtract } from "@/lib/crl-quote-fill";

export async function pollMailAccounts() {
  let processed = 0;
  let attachments = 0;
  await withOwnerClient(async (c) => {
    const accounts = await c.query(
      `SELECT * FROM mail_accounts WHERE refresh_token IS NOT NULL OR access_token IS NOT NULL`,
    );
    for (const acct of accounts.rows) {
      await c.query("SELECT set_config('app.company_id', $1, true)", [acct.company_id]);
      await c.query("SELECT set_config('app.role', 'system', true)");

      let token = acct.access_token as string | null;
      if (
        acct.refresh_token &&
        (!acct.token_expires_at || new Date(acct.token_expires_at) < new Date())
      ) {
        try {
          const refreshed = await refreshAccessToken(acct.refresh_token);
          token = refreshed.access_token;
          await c.query(
            `UPDATE mail_accounts SET access_token = $2, token_expires_at = $3 WHERE id = $1`,
            [
              acct.id,
              token,
              new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            ],
          );
        } catch {
          continue;
        }
      }
      if (!token) continue;

      const messages = await listRecentMessages(token, 10);
      for (const m of messages) {
        const exists = await c.query(
          `SELECT id FROM mail_messages WHERE company_id = $1 AND message_id = $2`,
          [acct.company_id, m.id],
        );
        if (exists.rows[0]) continue;

        const full = await getMessage(token, m.id);
        if (!full) continue;
        const headers = full.payload?.headers || [];
        const from = headers.find((h) => h.name.toLowerCase() === "from")?.value || "";
        const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value || "";

        const mailRow = await c.query(
          `INSERT INTO mail_messages
             (company_id, mail_account_id, message_id, thread_id, from_addr, subject, received_at)
           VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7::double precision / 1000))
           RETURNING id`,
          [
            acct.company_id,
            acct.id,
            full.id,
            full.threadId,
            from,
            subject,
            Number(full.internalDate || Date.now()),
          ],
        );
        processed += 1;
        const mailMessageId = mailRow.rows[0].id as string;

        if (acct.purpose === "service") {
          const { rows } = await c.query(
            `INSERT INTO tickets
               (company_id, issue, contact_phone, status, urgency, source)
             VALUES ($1, $2, '', 'new', 'normal', 'email') RETURNING id`,
            [acct.company_id, (subject || from || "Email intake").slice(0, 500)],
          );
          try {
            const match = await matchTicket(c, { name: subject });
            if (match.kind === "project") {
              await c.query(`UPDATE tickets SET project_id = $2 WHERE id = $1`, [
                rows[0].id,
                match.projectId,
              ]);
            } else if (match.kind === "no_match") {
              await c.query(`UPDATE tickets SET no_match = true WHERE id = $1`, [rows[0].id]);
            }
          } catch {
            /* best-effort */
          }
          await labelFiled(token, full.id);
          await c.query(`UPDATE mail_messages SET labeled = true WHERE id = $1`, [
            mailMessageId,
          ]);
          continue;
        }

        if (!supplierLooking(from, subject)) continue;

        const parts = collectAttachments(full.payload);
        const pdfParts = parts.filter(
          (p) =>
            p.mimeType === "application/pdf" ||
            p.filename.toLowerCase().endsWith(".pdf"),
        );

        if (pdfParts.length === 0) {
          const extracted = await extractDocument(`${subject}\n${from}`);
          await c.query(
            `INSERT INTO review_queue_items
               (company_id, mail_message_id, extract, confidence, status)
             VALUES ($1, $2, $3::jsonb, $4, 'open')`,
            [
              acct.company_id,
              mailMessageId,
              JSON.stringify(extracted),
              extracted?.confidence || 0.2,
            ],
          );
          continue;
        }

        for (const part of pdfParts) {
          const bytes = await getAttachment(token, full.id, part.attachmentId);
          if (!bytes) continue;
          attachments += 1;
          const text = await extractPdfText(bytes);
          const extracted = await extractDocument(text || `${subject}\n${from}`);
          const { rows: docRows } = await c.query(
            `INSERT INTO documents
               (company_id, file, type, mime, size, source, email_message_id, extracted)
             VALUES ($1, $2, 'other', 'application/pdf', $3, 'email', $4, $5::jsonb)
             RETURNING id`,
            [
              acct.company_id,
              part.filename,
              bytes.length,
              full.id,
              JSON.stringify(extracted),
            ],
          );
          const docId = docRows[0].id as string;
          const bucket = await getDocsBucket();
          await bucket.put(objectKey(acct.company_id, docId, part.filename), bytes, {
            httpMetadata: { contentType: "application/pdf" },
          });

          await c.query(
            `INSERT INTO ai_runs
               (company_id, kind, model, input, output, confidence, document_id)
             VALUES ($1, 'pdf_extract', $2, $3::jsonb, $4::jsonb, $5, $6)`,
            [
              acct.company_id,
              process.env.LLM_MODEL || "heuristic",
              JSON.stringify({ chars: text.length, mail_message_id: mailMessageId }),
              JSON.stringify(extracted),
              extracted?.confidence || 0,
              docId,
            ],
          );

          // CRL quote path
          if (
            extracted &&
            (extracted.quote_number ||
              (extracted.hardware_bom && extracted.hardware_bom.length) ||
              /crl|quote/i.test(subject))
          ) {
            await applyCrlQuoteExtract(c, acct.company_id, docId, extracted);
          }

          const { best, alternatives } = await matchExtractToOrders(
            c,
            extracted || {
              doc_type: "other",
              confidence: 0,
              line_items: [],
              hardware_bom: [],
              supplier: "",
              order_number: "",
              our_po_number: "",
              promised_date: "",
              ship_date: "",
              total: 0,
              quote_number: "",
            },
          );

          const docConf = extracted?.confidence || 0;
          const matchConf = best?.score || 0;
          const autoOk =
            docConf >= 0.9 &&
            matchConf >= 0.9 &&
            (await isAutonomyOn(c, acct.company_id, "auto_advance_procurement"));

          if (autoOk && best && extracted) {
            const adv = await applyProcurementAdvance(
              c,
              acct.company_id,
              extracted,
              best,
              docId,
            );
            if (adv.advanced) {
              await maybeFireGate(
                c,
                { companyId: acct.company_id, role: "system", userId: "system" },
                best.project_id,
              );
            } else {
              await c.query(
                `INSERT INTO review_queue_items
                   (company_id, document_id, mail_message_id, guessed_project_id,
                    alternatives, extract, confidence, status)
                 VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,'open')`,
                [
                  acct.company_id,
                  docId,
                  mailMessageId,
                  best.project_id,
                  JSON.stringify(alternatives),
                  JSON.stringify(extracted),
                  docConf,
                ],
              );
            }
          } else {
            await c.query(
              `INSERT INTO review_queue_items
                 (company_id, document_id, mail_message_id, guessed_project_id,
                  alternatives, extract, confidence, status)
               VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,'open')`,
              [
                acct.company_id,
                docId,
                mailMessageId,
                best?.project_id || null,
                JSON.stringify(alternatives),
                JSON.stringify(extracted),
                docConf,
              ],
            );
          }
        }

        await labelFiled(token, full.id);
        await c.query(`UPDATE mail_messages SET labeled = true WHERE id = $1`, [
          mailMessageId,
        ]);
      }
    }
  });
  return { processed, attachments };
}
