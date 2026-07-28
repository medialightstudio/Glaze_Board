// Per-job invoice — human tap from project screen (DEC-10).

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
  const body = (await req.json().catch(() => ({}))) as {
    kind?: string;
    deposit_percent?: number;
  };

  const project = await withUser(session, async (c) => {
    const { rows } = await c.query(`SELECT id, account_id FROM projects WHERE id = $1`, [id]);
    return rows[0];
  });
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const res = await fetch(new URL("/api/billing/invoices", req.url).toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: req.headers.get("cookie") || "",
    },
    body: JSON.stringify({
      account_id: project.account_id,
      project_ids: [id],
      kind: body.kind || "final",
      deposit_percent: body.deposit_percent,
    }),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
