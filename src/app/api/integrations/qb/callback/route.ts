import { NextResponse } from "next/server";
import { qbExchangeCode, detectQbProduct } from "@/lib/quickbooks";
import { withOwnerClient } from "@/lib/db-core";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const stateRaw = url.searchParams.get("state");
  if (!code || !stateRaw) return NextResponse.redirect("/m/settings?qb=error");
  const state = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8")) as {
    companyId: string;
  };
  const redirectUri = `${process.env.BETTER_AUTH_URL}/api/integrations/qb/callback`;
  const tokens = await qbExchangeCode(code, redirectUri);
  const expires = new Date(Date.now() + tokens.expires_in * 1000);
  const product = detectQbProduct();

  await withOwnerClient(async (c) => {
    await c.query("SELECT set_config('app.company_id', $1, true)", [state.companyId]);
    await c.query(
      `INSERT INTO qb_connections
         (company_id, realm_id, access_token, refresh_token, token_expires_at, product, connected_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (company_id) DO UPDATE SET
         realm_id = EXCLUDED.realm_id,
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         token_expires_at = EXCLUDED.token_expires_at,
         product = EXCLUDED.product,
         connected_at = now(),
         updated_at = now()`,
      [
        state.companyId,
        realmId,
        tokens.access_token,
        tokens.refresh_token,
        expires.toISOString(),
        product,
      ],
    );
  });

  if (product === "desktop") {
    return NextResponse.redirect("/m/settings?qb=desktop");
  }
  return NextResponse.redirect("/m/settings?qb=ok");
}
