// Save or remove a push subscription; toggle push_enabled on the user.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await req.json()) as {
    enabled?: boolean;
    subscription?: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    } | null;
  };

  try {
    await withUser(session, async (c) => {
      if (typeof body.enabled === "boolean") {
        await c.query(`UPDATE "user" SET push_enabled = $1 WHERE id = $2`, [
          body.enabled,
          session.userId,
        ]);
      }
      if (body.subscription?.endpoint && body.subscription.keys) {
        await c.query(
          `INSERT INTO push_subscriptions (company_id, user_id, endpoint, p256dh, auth)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, endpoint) DO UPDATE
             SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, updated_at = now()`,
          [
            session.companyId,
            session.userId,
            body.subscription.endpoint,
            body.subscription.keys.p256dh,
            body.subscription.keys.auth,
          ],
        );
        await c.query(`UPDATE "user" SET push_enabled = true WHERE id = $1`, [
          session.userId,
        ]);
      }
      if (body.enabled === false) {
        await c.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [
          session.userId,
        ]);
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not save push settings." },
      { status: 400 },
    );
  }
}
