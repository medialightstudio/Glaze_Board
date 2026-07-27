// Human-tapped send for propose-only message drafts.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;

  try {
    const result = await withUser(session, async (c) => {
      const { rows } = await c.query(`SELECT * FROM message_drafts WHERE id = $1`, [id]);
      const draft = rows[0];
      if (!draft || draft.status !== "draft") throw new Error("Draft not available.");
      // Outbound address must be provided by office; we log send intent.
      await c.query(
        `UPDATE message_drafts SET status = 'sent', sent_at = now() WHERE id = $1`,
        [id],
      );
      await c.query(
        `INSERT INTO activity_events (company_id, project_id, actor, actor_user_id, verb, details)
         VALUES ($1, $2, 'office', $3, 'draft_sent', $4::jsonb)`,
        [
          session.companyId,
          draft.project_id,
          session.userId,
          JSON.stringify({ draft_id: id, kind: draft.kind }),
        ],
      );
      return draft;
    });
    return NextResponse.json({ ok: true, draft: result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed." },
      { status: 400 },
    );
  }
}
