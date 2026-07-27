import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/gmail";
import { withOwnerClient } from "@/lib/db-core";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  if (!code || !stateRaw) {
    return NextResponse.redirect("/m/settings?gmail=error");
  }
  const state = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8")) as {
    companyId: string;
    purpose: string;
  };
  const redirectUri = `${process.env.BETTER_AUTH_URL}/api/integrations/gmail/callback`;
  const tokens = await exchangeCode(code, redirectUri);
  const expires = new Date(Date.now() + tokens.expires_in * 1000);

  await withOwnerClient(async (c) => {
    await c.query("SELECT set_config('app.company_id', $1, true)", [state.companyId]);
    await c.query(
      `INSERT INTO mail_accounts
         (company_id, purpose, email, refresh_token, access_token, token_expires_at, connected_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (company_id, purpose) DO UPDATE SET
         refresh_token = COALESCE(EXCLUDED.refresh_token, mail_accounts.refresh_token),
         access_token = EXCLUDED.access_token,
         token_expires_at = EXCLUDED.token_expires_at,
         connected_at = now()`,
      [
        state.companyId,
        state.purpose,
        `${state.purpose}@connected`,
        tokens.refresh_token || null,
        tokens.access_token,
        expires.toISOString(),
      ],
    );
  });

  return NextResponse.redirect("/m/settings?gmail=ok");
}
