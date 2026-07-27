// Twilio voice — after-hours gather → create ticket mid-flow.

import { NextResponse } from "next/server";
import { withOwnerClient } from "@/lib/db-core";
import { twilioVoiceTwiml } from "@/lib/twilio";
import { sendSms } from "@/lib/twilio";
import { dedupeTicket } from "@/lib/matching";

export async function POST(req: Request) {
  const form = await req.formData();
  const from = String(form.get("From") || "");
  const speech = String(form.get("SpeechResult") || form.get("Digits") || "");
  const companyId = process.env.DEFAULT_COMPANY_ID;

  if (!speech) {
    const base = process.env.BETTER_AUTH_URL || "https://glazeboard.com";
    const xml = twilioVoiceTwiml(
      "Thanks for calling. Briefly describe the issue after the tone.",
      `${base}/api/webhooks/twilio/voice`,
    );
    return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
  }

  if (companyId) {
    await withOwnerClient(async (c) => {
      await c.query("SELECT set_config('app.company_id', $1, true)", [companyId]);
      const recent = await dedupeTicket(c, companyId, from, null);
      if (recent) {
        await c.query(
          `INSERT INTO call_logs (company_id, ticket_id, from_phone, transcript)
           VALUES ($1, $2, $3, $4)`,
          [companyId, recent, from, speech],
        );
        return;
      }
      const { rows } = await c.query(
        `INSERT INTO tickets
           (company_id, issue, contact_phone, status, urgency, source)
         VALUES ($1, $2, $3, 'new', $4, 'call') RETURNING id`,
        [
          companyId,
          speech.slice(0, 500),
          from,
          /leak|flood|broken glass|emergency/i.test(speech) ? "urgent" : "normal",
        ],
      );
      await c.query(
        `INSERT INTO call_logs (company_id, ticket_id, from_phone, transcript)
         VALUES ($1, $2, $3, $4)`,
        [companyId, rows[0].id, from, speech],
      );
      // Sole auto-send exception: templated ticket ack (48h dedupe already above).
      await sendSms(
        from,
        "We got your message — we'll call you back today. Reply with the site address if you can.",
      );
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Got it. Someone from the office will call you back today. Goodbye.</Say>
</Response>`;
  return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
}
