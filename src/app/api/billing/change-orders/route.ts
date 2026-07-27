import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await req.json()) as {
    project_id?: string;
    description?: string;
    amount_cents?: number;
  };
  if (!body.project_id || !body.description) {
    return NextResponse.json({ error: "project_id and description required." }, { status: 400 });
  }
  const row = await withUser(session, async (c) => {
    const { rows } = await c.query(
      `INSERT INTO change_orders (company_id, project_id, description, amount_cents)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [
        session.companyId,
        body.project_id,
        body.description,
        Math.round(Number(body.amount_cents) || 0),
      ],
    );
    return rows[0];
  });
  return NextResponse.json(row, { status: 201 });
}
