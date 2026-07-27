// Inbound SMS / WhatsApp via Twilio — ticket pipeline + thread store.

import { NextResponse } from "next/server";
import { withOwnerClient } from "@/lib/db-core";
import { matchTicket, dedupeTicket } from "@/lib/matching";

export async function POST(req: Request) {
  const form = await req.formData();
  const from = String(form.get("From") || "").replace(/^whatsapp:/, "");
  const body = String(form.get("Body") || "");
  const companyId = process.env.DEFAULT_COMPANY_ID;
  if (!companyId || !from) {
    return new NextResponse("<Response></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  }

  await withOwnerClient(async (c) => {
    await c.query("SELECT set_config('app.company_id', $1, true)", [companyId]);
    let thread = await c.query(
      `SELECT id FROM sms_threads WHERE company_id = $1 AND phone = $2 ORDER BY created_at DESC LIMIT 1`,
      [companyId, from],
    );
    if (!thread.rows[0]) {
      thread = await c.query(
        `INSERT INTO sms_threads (company_id, phone) VALUES ($1, $2) RETURNING id`,
        [companyId, from],
      );
    }
    await c.query(
      `INSERT INTO sms_messages (company_id, thread_id, direction, body, status)
       VALUES ($1, $2, 'inbound', $3, 'received')`,
      [companyId, thread.rows[0].id, body],
    );

    const recent = await dedupeTicket(c, companyId, from, null);
    if (!recent) {
      const { rows } = await c.query(
        `INSERT INTO tickets (company_id, issue, contact_phone, status, source)
         VALUES ($1, $2, $3, 'new', 'sms') RETURNING id`,
        [companyId, body.slice(0, 500) || "SMS", from],
      );
      const match = await matchTicket(c, { phone: from, address: body });
      if (match.kind === "project") {
        await c.query(`UPDATE tickets SET project_id = $2 WHERE id = $1`, [
          rows[0].id,
          match.projectId,
        ]);
        await c.query(`UPDATE sms_threads SET ticket_id = $2, project_id = $3 WHERE id = $1`, [
          thread.rows[0].id,
          rows[0].id,
          match.projectId,
        ]);
      }
    }
  });

  return new NextResponse("<Response></Response>", {
    headers: { "Content-Type": "text/xml" },
  });
}
