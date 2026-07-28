import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { randomBindCode } from "@/lib/telegram";

export async function POST() {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const code = randomBindCode();
  await withUser(session, async (c) => {
    await c.query(
      `INSERT INTO messenger_bindings (company_id, user_id, channel, chat_id, bind_code)
       VALUES ($1, $2, 'telegram', $3, $4)`,
      [session.companyId, session.userId, `pending:${session.userId}:${code}`, code],
    );
  });
  return NextResponse.json({ code });
}
