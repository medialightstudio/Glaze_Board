// Twilio SMS / voice helpers via fetch (no SDK).

function creds() {
  const sid = process.env.TWILIO_ACCOUNT_SID || "";
  const token = process.env.TWILIO_AUTH_TOKEN || "";
  const from = process.env.TWILIO_FROM_NUMBER || "";
  return { sid, token, from, ok: Boolean(sid && token && from) };
}

export function twilioConfigured() {
  return creds().ok;
}

export async function sendSms(to: string, body: string) {
  const { sid, token, from, ok } = creds();
  if (!ok) return { ok: false as const, reason: "not_configured" };
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    },
  );
  if (!res.ok) return { ok: false as const, reason: "send_failed" };
  const data = (await res.json()) as { sid?: string };
  return { ok: true as const, sid: data.sid };
}

export function twilioVoiceTwiml(say: string, gatherAction: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech dtmf" action="${gatherAction}" timeout="4" speechTimeout="auto">
    <Say>${escapeXml(say)}</Say>
  </Gather>
  <Say>Sorry, I did not catch that. Goodbye.</Say>
</Response>`;
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
