// Load QB connection with token refresh; ensure account has qb_customer_id.

import type { PoolClient } from "@neondatabase/serverless";
import { qbFindOrCreateCustomer, qbRefreshToken } from "@/lib/quickbooks";

export async function getFreshQbConnection(client: PoolClient, companyId: string) {
  const { rows } = await client.query(`SELECT * FROM qb_connections WHERE company_id = $1`, [
    companyId,
  ]);
  const conn = rows[0];
  if (!conn?.access_token || !conn.realm_id) return null;

  let access = conn.access_token as string;
  if (
    conn.refresh_token &&
    conn.token_expires_at &&
    new Date(conn.token_expires_at) < new Date(Date.now() + 60_000)
  ) {
    const refreshed = await qbRefreshToken(conn.refresh_token);
    access = refreshed.access_token;
    await client.query(
      `UPDATE qb_connections SET
         access_token = $2, refresh_token = $3, token_expires_at = $4, updated_at = now()
       WHERE company_id = $1`,
      [
        companyId,
        refreshed.access_token,
        refreshed.refresh_token,
        new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      ],
    );
  }
  return { ...conn, access_token: access };
}

export async function ensureQbCustomerId(
  client: PoolClient,
  companyId: string,
  accountId: string,
) {
  const acct = await client.query(`SELECT id, name, qb_customer_id FROM accounts WHERE id = $1`, [
    accountId,
  ]);
  if (!acct.rows[0]) throw new Error("Customer not found.");
  if (acct.rows[0].qb_customer_id) return acct.rows[0].qb_customer_id as string;

  const conn = await getFreshQbConnection(client, companyId);
  if (!conn) throw new Error("QuickBooks not connected.");

  const qbId = await qbFindOrCreateCustomer(
    conn.realm_id,
    conn.access_token,
    acct.rows[0].name,
  );
  await client.query(`UPDATE accounts SET qb_customer_id = $2 WHERE id = $1`, [
    accountId,
    qbId,
  ]);
  return qbId;
}
