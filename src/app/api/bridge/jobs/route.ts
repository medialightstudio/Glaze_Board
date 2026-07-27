// Enqueue CRL Bridge jobs (L1/L2) — requires ToS + feature flag.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { enqueueBridgeJob } from "@/lib/bridge";

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await req.json() as any;
  const projectId = String(body.project_id || "");
  const level = Number(body.level) === 2 ? 2 : 1;
  if (!projectId) return NextResponse.json({ error: "project_id required." }, { status: 400 });

  try {
    const job = await withUser(session, async (c) => {
      const p = await c.query(
        `SELECT id, title, site_address, measurements FROM projects WHERE id = $1`,
        [projectId],
      );
      if (!p.rows[0]) throw new Error("Project not found.");
      return enqueueBridgeJob(c, session.companyId, projectId, level as 1 | 2, {
        title: p.rows[0].title,
        site_address: p.rows[0].site_address,
        measurements: p.rows[0].measurements || {},
      });
    });
    return NextResponse.json(job, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed." },
      { status: 400 },
    );
  }
}
