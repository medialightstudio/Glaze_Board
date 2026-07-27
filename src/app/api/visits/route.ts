// POST book visit; measure/install also call matching status transition.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { transition } from "@/lib/status-machine";

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await req.json()) as Record<string, any>;
  const type = String(body.type || "").trim();
  const startsAt = String(body.starts_at || "").trim();
  if (!type || !startsAt) {
    return NextResponse.json({ error: "Type and start time are required." }, { status: 400 });
  }
  if (!["measure", "install", "service"].includes(type)) {
    return NextResponse.json({ error: "Type must be measure, install, or service." }, { status: 400 });
  }

  try {
    const visit = await withUser(session, async (c) => {
      const assignees = Array.isArray(body.assignees) ? body.assignees : [];
      const { rows } = await c.query(
        `INSERT INTO visits
           (company_id, type, project_id, ticket_id, starts_at, duration, assignees, team_id)
         VALUES ($1, $2, $3, $4, $5::timestamptz,
                 COALESCE($6::interval, '2 hours'), $7, $8)
         RETURNING *`,
        [
          session.companyId,
          type,
          body.project_id || null,
          body.ticket_id || null,
          startsAt,
          body.duration || null,
          assignees,
          body.team_id || null,
        ],
      );

      if (body.project_id && (type === "measure" || type === "install")) {
        const to = type === "measure" ? "measure_scheduled" : "install_scheduled";
        try {
          await transition(c, session, body.project_id, to, {
            kind: "user",
            userId: session.userId,
          });
        } catch {
          // Already past that status — visit still booked.
        }
      }
      return rows[0];
    });
    return NextResponse.json(visit, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not book visit." },
      { status: 400 },
    );
  }
}
