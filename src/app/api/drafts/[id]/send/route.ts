// Human-tapped Send — real Resend/Twilio delivery.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { sendDraft } from "@/lib/drafts";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    to_email?: string;
    to_phone?: string;
  };

  try {
    const draft = await withUser(session, async (c) => {
      // Resolve default contact email from project if needed
      let toEmail = body.to_email || null;
      let toPhone = body.to_phone || null;
      const d = await c.query(`SELECT * FROM message_drafts WHERE id = $1`, [id]);
      if (!d.rows[0]) throw new Error("Draft not found.");
      if (!toEmail && !toPhone && d.rows[0].project_id) {
        const contact = await c.query(
          `SELECT c.email, c.phone FROM project_contacts pc
           JOIN contacts c ON c.id = pc.contact_id
           WHERE pc.project_id = $1
           ORDER BY pc.is_primary DESC NULLS LAST LIMIT 1`,
          [d.rows[0].project_id],
        );
        toEmail = contact.rows[0]?.email || null;
        toPhone = contact.rows[0]?.phone || null;
      }
      return sendDraft(c, session.companyId, id, { toEmail, toPhone });
    });
    return NextResponse.json({ ok: true, draft });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed." },
      { status: 400 },
    );
  }
}
