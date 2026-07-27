// GET list accounts · POST create customer (name required).

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { createAccount, listAccounts } from "@/lib/db";

export async function GET() {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const rows = await withUser(session, (c) => listAccounts(c));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await req.json()) as Record<string, any>;
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  const row = await withUser(session, (c) =>
    createAccount(c, session.companyId, {
      name,
      phone: body.phone,
      email: body.email,
      billing_type: body.billing_type,
    }),
  );
  return NextResponse.json(row, { status: 201 });
}
