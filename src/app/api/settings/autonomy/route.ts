import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }
  const body = await req.json() as any;
  const toggles = body.toggles || {};
  await withUser(session, async (c) => {
    await c.query(
      `INSERT INTO autonomy_settings (company_id, toggles, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (company_id) DO UPDATE SET toggles = $2::jsonb, updated_at = now()`,
      [session.companyId, JSON.stringify(toggles)],
    );
  });
  return NextResponse.json({ ok: true });
}
