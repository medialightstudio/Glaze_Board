// GET ?q= — grouped search across projects, contacts, accounts, orders.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { searchAll } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (q.length < 2) {
    return NextResponse.json({
      projects: [],
      contacts: [],
      accounts: [],
      glass: [],
      hardware: [],
    });
  }
  const results = await withUser(session, (c) => searchAll(c, q));
  return NextResponse.json(results);
}
