// Single database door — Neon Pool, request-scoped company/role via set_config(..., true). DEC-21, DEC-23.

import { Pool, type PoolClient } from "@neondatabase/serverless";

export type AppSession = {
  companyId: string;
  role: string;
  userId: string;
};

export type DbClient = PoolClient;

let appPool: Pool | null = null;
let migratePool: Pool | null = null;

function getAppPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is blank.");
  if (!appPool) appPool = new Pool({ connectionString: url });
  return appPool;
}

function getOwnerPool(): Pool {
  // Auth/migrations helpers that must run as owner (table owner / DDL path).
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("MIGRATE_DATABASE_URL is blank.");
  if (!migratePool) migratePool = new Pool({ connectionString: url });
  return migratePool;
}

async function withClient<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/** Business queries — stamps company_id and role for the transaction (request-scoped). */
export async function withUser<T>(
  session: AppSession,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withClient(getAppPool(), async (client) => {
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
  return withClient(getAppPool(), async (client) => {
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
  return withClient(getAppPool(), async (client) => {
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
  return withClient(getOwnerPool(), fn);
}
