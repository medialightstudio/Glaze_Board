// POST { event_id } — undo a status_changed feed entry via status-machine.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { undo } from "@/lib/status-machine";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id: projectId } = await params;
  const body = (await req.json()) as { event_id?: string };
  const eventId = String(body.event_id || "");
  if (!eventId) {
    return NextResponse.json({ error: "event_id required." }, { status: 400 });
  }

  try {
    const result = await withUser(session, async (c) => {
      const ev = await c.query(
        `SELECT project_id FROM activity_events WHERE id = $1`,
        [eventId],
      );
      if (!ev.rows[0] || ev.rows[0].project_id !== projectId) {
        throw new Error("Feed entry not on this project.");
      }
      return undo(c, session, eventId, { kind: "user", userId: session.userId });
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Undo failed." },
      { status: 400 },
    );
  }
}
