import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }
  const body = (await req.json()) as {
    crl_tos_accepted?: boolean;
    crl_bridge_enabled?: boolean;
  };
  await withUser(session, async (c) => {
    await c.query(
      `UPDATE companies SET
         crl_tos_accepted = COALESCE($2, crl_tos_accepted),
         crl_bridge_enabled = COALESCE($3, crl_bridge_enabled),
         updated_at = now()
       WHERE id = $1`,
      [
        session.companyId,
        body.crl_tos_accepted ?? null,
        body.crl_bridge_enabled ?? null,
      ],
    );
  });
  return NextResponse.json({ ok: true });
}
