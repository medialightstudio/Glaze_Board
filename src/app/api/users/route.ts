// GET list company users · POST create via better-auth sign-up then set role/company (admin).

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser, readAuth } from "@/lib/db-core";
import { auth } from "@/lib/auth/auth";

export async function GET() {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const rows = await withUser(session, async (c) => {
    const { rows: users } = await c.query(
      `SELECT id, name, email, role, active, phone FROM "user"
       WHERE company_id = $1 ORDER BY name`,
      [session.companyId],
    );
    return users;
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Only admins can create users." }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, any>;
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const role = String(body.role || "field");
  const password = String(body.password || "").trim();
  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Name, email, and temporary password are required." },
      { status: 400 },
    );
  }
  if (!["admin", "manager", "field"].includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  try {
    await auth.api.signUpEmail({
      body: { name, email, password },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sign-up failed." },
      { status: 400 },
    );
  }

  const user = await readAuth(async (c) => {
    const { rows } = await c.query(
      `UPDATE "user"
       SET company_id = $1, role = $2, active = true
       WHERE email = $3
       RETURNING id, name, email, role, active, phone`,
      [session.companyId, role, email],
    );
    return rows[0];
  });

  if (!user) {
    return NextResponse.json({ error: "User created but link failed." }, { status: 500 });
  }
  return NextResponse.json(user, { status: 201 });
}
