// Single database door — Neon Pool, request-scoped company/role via set_config(..., true). DEC-21, DEC-23.
// Cloudflare Workers: never reuse a Pool across requests (cross-request I/O → Error 1101).

import { Pool, type PoolClient } from "@neondatabase/serverless";

export type AppSession = {
  companyId: string;
  role: string;
  userId: string;
};

export type DbClient = PoolClient;

function appUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is blank.");
  return url;
}

function ownerUrl() {
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("MIGRATE_DATABASE_URL is blank.");
  return url;
}

/** Fresh Pool per call — Workers bind WebSocket I/O to the creating request. */
async function withClient<T>(
  connectionString: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const client = await pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  } finally {
    await pool.end().catch(() => {});
  }
}

/** Business queries — stamps company_id and role for the transaction (request-scoped). */
export async function withUser<T>(
  session: AppSession,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withClient(appUrl(), async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("SELECT set_config('app.company_id', $1, true)", [
        session.companyId,
      ]);
      await client.query("SELECT set_config('app.role', $1, true)", [
        session.role,
      ]);
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  });
}

/** Login library tables only — no company filter (DEC-23). */
export async function readAuth<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withClient(appUrl(), async (client) => {
    await client.query("BEGIN");
    try {
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  });
}

/** Public service form — company from URL slug; policy allows ticket insert only. */
export async function systemContext<T>(
  companyId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withClient(appUrl(), async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("SELECT set_config('app.company_id', $1, true)", [
        companyId,
      ]);
      await client.query("SELECT set_config('app.role', $1, true)", [
        "system",
      ]);
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  });
}

/** Owner-pool helper for migrate/check scripts — not for request handlers. */
export async function withOwnerClient<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withClient(ownerUrl(), fn);
}
