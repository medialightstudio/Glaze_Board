// SMS threads — list + propose-only outbound (human tap).

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { sendSms } from "@/lib/twilio";

export async function GET(req: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const url = new URL(req.url);
  const projectId = url.searchParams.get("project_id");
  const ticketId = url.searchParams.get("ticket_id");
  const data = await withUser(session, async (c) => {
    let thread = await c.query(
      `SELECT * FROM sms_threads
       WHERE company_id = $1
         AND (($2::uuid IS NULL OR project_id = $2)
          AND ($3::uuid IS NULL OR ticket_id = $3))
       ORDER BY created_at DESC LIMIT 1`,
      [session.companyId, projectId, ticketId],
    );
    if (!thread.rows[0] && (projectId || ticketId)) {
      const phone = await c.query(
        ticketId
          ? `SELECT contact_phone AS phone FROM tickets WHERE id = $1`
          : `SELECT c.phone FROM project_contacts pc
             JOIN contacts c ON c.id = pc.contact_id
             WHERE pc.project_id = $1 ORDER BY pc.is_primary DESC LIMIT 1`,
        [ticketId || projectId],
      );
      if (phone.rows[0]?.phone) {
        thread = await c.query(
          `INSERT INTO sms_threads (company_id, project_id, ticket_id, phone)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [session.companyId, projectId, ticketId, phone.rows[0].phone],
        );
      }
    }
    if (!thread.rows[0]) return { thread: null, messages: [] };
    const msgs = await c.query(
      `SELECT * FROM sms_messages WHERE thread_id = $1 ORDER BY created_at ASC`,
      [thread.rows[0].id],
    );
    return { thread: thread.rows[0], messages: msgs.rows };
  });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await req.json()) as {
    thread_id?: string;
    body?: string;
    confirm?: boolean;
  };
  if (!body.thread_id || !body.body) {
    return NextResponse.json({ error: "thread_id and body required." }, { status: 400 });
  }
  if (!body.confirm) {
    return NextResponse.json({ error: "Outbound SMS requires confirm: true (DEC-10)." }, { status: 400 });
  }

  try {
    const result = await withUser(session, async (c) => {
      const t = await c.query(`SELECT * FROM sms_threads WHERE id = $1`, [body.thread_id]);
      if (!t.rows[0]) throw new Error("Thread not found.");
      const sent = await sendSms(t.rows[0].phone, body.body!);
      if (!sent.ok) throw new Error("Twilio send failed — check TWILIO_* secrets.");
      const { rows } = await c.query(
        `INSERT INTO sms_messages
           (company_id, thread_id, direction, body, status, twilio_sid)
         VALUES ($1, $2, 'outbound', $3, 'sent', $4) RETURNING *`,
        [session.companyId, body.thread_id, body.body, sent.sid || null],
      );
      return rows[0];
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed." },
      { status: 400 },
    );
  }
}
