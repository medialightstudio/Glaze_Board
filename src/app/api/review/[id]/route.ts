// Review Queue actions — confirm / reassign / ignore.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const body = await req.json() as any;
  const action = String(body.action || "");
  const projectId = body.project_id ? String(body.project_id) : null;

  try {
    await withUser(session, async (c) => {
      const { rows } = await c.query(`SELECT * FROM review_queue_items WHERE id = $1`, [id]);
      const item = rows[0];
      if (!item || item.status !== "open") throw new Error("Item not open.");

      if (action === "ignore") {
        await c.query(
          `UPDATE review_queue_items SET status = 'ignored', resolved_by = $2, resolved_at = now()
           WHERE id = $1`,
          [id, session.userId],
        );
        return;
      }

      if ((action === "confirm" || action === "reassign") && !projectId) {
        throw new Error("Pick a project.");
      }

      if (item.document_id && projectId) {
        await c.query(`UPDATE documents SET project_id = $2 WHERE id = $1`, [
          item.document_id,
          projectId,
        ]);
      }

      await c.query(
        `UPDATE review_queue_items
         SET status = $2, guessed_project_id = $3, resolved_by = $4, resolved_at = now()
         WHERE id = $1`,
        [id, action === "reassign" ? "reassigned" : "confirmed", projectId, session.userId],
      );

      if (projectId) {
        await c.query(
          `INSERT INTO activity_events (company_id, project_id, actor, actor_user_id, verb, details)
           VALUES ($1, $2, 'office', $3, 'review_resolved', $4::jsonb)`,
          [
            session.companyId,
            projectId,
            session.userId,
            JSON.stringify({ review_id: id, action }),
          ],
        );
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed." },
      { status: 400 },
    );
  }
}
