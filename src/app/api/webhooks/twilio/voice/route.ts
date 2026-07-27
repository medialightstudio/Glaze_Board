// Twilio voice — structured gather → mid-call ticket → SMS ack (48h dedupe).

import { NextResponse } from "next/server";
import { withOwnerClient } from "@/lib/db-core";
import { sendSms } from "@/lib/twilio";
import { dedupeTicket, matchTicket } from "@/lib/matching";
import { proposeWarranty } from "@/lib/matching";

function xml(body: string) {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, {
    headers: { "Content-Type": "text/xml" },
  });
}

function say(text: string) {
  // ElevenLabs reserved — day-one Twilio Say (OBSERVED if no ELEVENLABS_API_KEY).
  return `<Say voice="Polly.Joanna">${escapeXml(text)}</Say>`;
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: Request) {
  const form = await req.formData();
  const from = String(form.get("From") || "");
  const speech = String(form.get("SpeechResult") || form.get("Digits") || "").trim();
  const url = new URL(req.url);
  const step = url.searchParams.get("step") || "issue";
  const base = process.env.BETTER_AUTH_URL || "https://glazeboard.com";
  const companyId = process.env.DEFAULT_COMPANY_ID;

  const name = url.searchParams.get("name") || "";
  const address = url.searchParams.get("address") || "";
  const issue = url.searchParams.get("issue") || "";

  if (!speech && step === "issue") {
    return xml(`<Response>
  <Gather input="speech dtmf" action="${base}/api/webhooks/twilio/voice?step=issue" timeout="5" speechTimeout="auto">
    ${say("Thanks for calling. Briefly describe the issue after the tone.")}
  </Gather>
  ${say("Sorry, I did not catch that. Goodbye.")}
</Response>`);
  }

  if (step === "issue") {
    const next = new URLSearchParams({
      step: "address",
      issue: speech,
      name,
    });
    return xml(`<Response>
  <Gather input="speech dtmf" action="${base}/api/webhooks/twilio/voice?${next}" timeout="5" speechTimeout="auto">
    ${say("What is the service address?")}
  </Gather>
  ${say("Goodbye.")}
</Response>`);
  }

  if (step === "address") {
    const next = new URLSearchParams({
      step: "finish",
      issue: issue || speech,
      address: speech,
      name,
    });
    return xml(`<Response>
  <Gather input="speech dtmf" action="${base}/api/webhooks/twilio/voice?${next}" timeout="4" speechTimeout="auto">
    ${say(`I heard ${speech}. Is water actively leaking? Say yes or no.`)}
  </Gather>
  ${say("We will call you back today. Goodbye.")}
</Response>`);
  }

  // finish
  const urgent = /yes|leak|flood|emergency/i.test(speech);
  const finalIssue = issue || speech;
  const finalAddress = address;

  if (companyId) {
    await withOwnerClient(async (c) => {
      await c.query("SELECT set_config('app.company_id', $1, true)", [companyId]);
      const recent = await dedupeTicket(c, companyId, from, null);
      if (recent) {
        await c.query(
          `INSERT INTO call_logs (company_id, ticket_id, from_phone, transcript, analysis)
           VALUES ($1, $2, $3, $4, $5::jsonb)`,
          [
            companyId,
            recent,
            from,
            `${finalIssue} @ ${finalAddress}`,
            JSON.stringify({ urgent, deduped: true }),
          ],
        );
        return;
      }

      const { rows } = await c.query(
        `INSERT INTO tickets
           (company_id, issue, contact_name, contact_phone, address, status, urgency, source)
         VALUES ($1, $2, $3, $4, $5, 'new', $6, 'call') RETURNING id`,
        [
          companyId,
          finalIssue.slice(0, 500),
          name || null,
          from,
          finalAddress || null,
          urgent ? "urgent" : "normal",
        ],
      );
      const ticketId = rows[0].id as string;
      const match = await matchTicket(c, {
        address: finalAddress,
        phone: from,
        name,
      });
      let warranty = false;
      if (match.kind === "project") {
        await c.query(`UPDATE tickets SET project_id = $2 WHERE id = $1`, [
          ticketId,
          match.projectId,
        ]);
        const inst = await c.query(
          `SELECT (status_timestamps->>'installed')::timestamptz AS installed_at
           FROM projects WHERE id = $1`,
          [match.projectId],
        );
        warranty = proposeWarranty(
          inst.rows[0]?.installed_at ? new Date(inst.rows[0].installed_at) : null,
        );
        if (warranty) {
          await c.query(
            `UPDATE tickets SET classification = 'warranty' WHERE id = $1`,
            [ticketId],
          );
        }
      } else if (match.kind === "no_match") {
        await c.query(`UPDATE tickets SET no_match = true WHERE id = $1`, [ticketId]);
      }

      await c.query(
        `INSERT INTO call_logs (company_id, ticket_id, from_phone, transcript, analysis)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
          companyId,
          ticketId,
          from,
          `${finalIssue} @ ${finalAddress}; urgency=${speech}`,
          JSON.stringify({ urgent, warranty, match: match.kind }),
        ],
      );

      await sendSms(
        from,
        "We got your message — we'll call you back today. Reply with photos if you can.",
      );
    });
  }

  return xml(`<Response>
  ${say("Got it. Someone from the office will call you back today. Goodbye.")}
</Response>`);
}
