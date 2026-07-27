// Poll connected Gmail accounts and file supplier PDFs / service tickets.

import { withOwnerClient } from "@/lib/db-core";
import {
  getMessage,
  listRecentMessages,
  refreshAccessToken,
  supplierLooking,
} from "@/lib/gmail";
import { extractPdfText } from "@/lib/pdf/extract";
import { extractDocument } from "@/lib/ai";
import { getDocsBucket, objectKey } from "@/lib/storage";
import { matchTicket } from "@/lib/matching";

export async function pollMailAccounts() {
  let processed = 0;
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

      const messages = await listRecentMessages(token, 8);
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

        await c.query(
          `INSERT INTO mail_messages
             (company_id, mail_account_id, message_id, thread_id, from_addr, subject, received_at)
           VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7::double precision / 1000))`,
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

        if (acct.purpose === "service") {
          const { rows } = await c.query(
            `INSERT INTO tickets
               (company_id, issue, contact_phone, status, urgency, source)
             VALUES ($1, $2, '', 'new', 'normal', 'email') RETURNING id`,
            [acct.company_id, subject || from || "Email intake"],
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
            /* matching best-effort */
          }
          continue;
        }

        if (!supplierLooking(from, subject)) continue;

        // Attachment handling is limited without full Gmail attachment fetch in this pass;
        // store a review stub when subject looks like an order doc.
        const text = `${subject}\n${from}`;
        const extracted = await extractDocument(text);
        await c.query(
          `INSERT INTO review_queue_items (company_id, extract, confidence, status)
           VALUES ($1, $2::jsonb, $3, 'open')`,
          [acct.company_id, JSON.stringify(extracted), extracted?.confidence || 0.3],
        );
      }
    }
  });
  return { processed };
}

/** Manual path used when a PDF buffer is already in hand (uploads / future attachment fetch). */
export async function filePdfBytes(
  companyId: string,
  projectId: string | null,
  fileName: string,
  bytes: Uint8Array,
) {
  return withOwnerClient(async (c) => {
    await c.query("SELECT set_config('app.company_id', $1, true)", [companyId]);
    const text = await extractPdfText(bytes);
    const extracted = await extractDocument(text);
    const { rows } = await c.query(
      `INSERT INTO documents (company_id, file, type, mime, size, project_id, source, extracted)
       VALUES ($1, $2, 'other', 'application/pdf', $3, $4, 'email', $5::jsonb) RETURNING id`,
      [companyId, fileName, bytes.length, projectId, JSON.stringify(extracted)],
    );
    const docId = rows[0].id;
    const bucket = await getDocsBucket();
    await bucket.put(objectKey(companyId, docId, fileName), bytes, {
      httpMetadata: { contentType: "application/pdf" },
    });
    if (!projectId || (extracted?.confidence || 0) < 0.9) {
      await c.query(
        `INSERT INTO review_queue_items
           (company_id, document_id, guessed_project_id, extract, confidence, status)
         VALUES ($1, $2, $3, $4::jsonb, $5, 'open')`,
        [companyId, docId, projectId, JSON.stringify(extracted), extracted?.confidence || 0],
      );
    }
    return { docId, extracted };
  });
}
