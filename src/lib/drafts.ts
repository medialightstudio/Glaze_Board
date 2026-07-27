// Propose-only message drafts — create + real Send via Resend/Twilio.

import type { PoolClient } from "@neondatabase/serverless";
import { notifyEmail } from "@/lib/notify";
import { sendSms } from "@/lib/twilio";

export async function createDraft(
  client: PoolClient,
  companyId: string,
  opts: {
    projectId?: string | null;
    kind: string;
    channel?: string;
    body: string;
  },
) {
  const existing = await client.query(
    `SELECT id FROM message_drafts
     WHERE company_id = $1 AND kind = $2 AND status = 'draft'
       AND (($3::uuid IS NULL AND project_id IS NULL) OR project_id = $3)
     LIMIT 1`,
    [companyId, opts.kind, opts.projectId || null],
  );
  if (existing.rows[0]) return existing.rows[0];
  const { rows } = await client.query(
    `INSERT INTO message_drafts (company_id, project_id, kind, channel, body, status)
     VALUES ($1, $2, $3, $4, $5, 'draft') RETURNING *`,
    [
      companyId,
      opts.projectId || null,
      opts.kind,
      opts.channel || "email",
      opts.body,
    ],
  );
  return rows[0];
}

export async function sendDraft(
  client: PoolClient,
  companyId: string,
  draftId: string,
  opts: { toEmail?: string | null; toPhone?: string | null },
) {
  const { rows } = await client.query(`SELECT * FROM message_drafts WHERE id = $1`, [
    draftId,
  ]);
  const draft = rows[0];
  if (!draft || draft.status !== "draft") throw new Error("Draft not available.");

  let delivered = false;
  if (draft.channel === "sms" || opts.toPhone) {
    if (opts.toPhone) {
      const r = await sendSms(opts.toPhone, draft.body);
      delivered = r.ok;
    }
  } else if (opts.toEmail) {
    const r = await notifyEmail(opts.toEmail, `Glaze Board — ${draft.kind}`, draft.body);
    delivered = r.ok;
  }

  if (!delivered && !opts.toEmail && !opts.toPhone) {
    throw new Error("Provide a send-to email or phone.");
  }
  if (!delivered) throw new Error("Outbound send failed — check Resend/Twilio config.");

  await client.query(
    `UPDATE message_drafts SET status = 'sent', sent_at = now() WHERE id = $1`,
    [draftId],
  );
  await client.query(
    `INSERT INTO activity_events (company_id, project_id, actor, verb, details)
     VALUES ($1, $2, 'office', 'draft_sent', $3::jsonb)`,
    [
      companyId,
      draft.project_id,
      JSON.stringify({ draft_id: draftId, kind: draft.kind, delivered: true }),
    ],
  );
  return draft;
}
