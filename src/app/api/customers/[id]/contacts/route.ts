// POST add contact to an account.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { createContact, getAccount } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as Record<string, any>;
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const row = await withUser(session, async (c) => {
    const account = await getAccount(c, id);
    if (!account) throw new Error("Customer not found.");
    return createContact(c, session.companyId, {
      account_id: id,
      name,
      phone: body.phone,
      email: body.email,
    });
  });
  return NextResponse.json(row, { status: 201 });
}
