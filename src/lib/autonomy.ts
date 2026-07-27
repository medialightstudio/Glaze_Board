// Read per-company autonomy toggles — default all off (DEC-1 / systems §1).

import type { PoolClient } from "@neondatabase/serverless";

export async function getAutonomyToggles(
  client: PoolClient,
  companyId: string,
): Promise<Record<string, boolean>> {
  const { rows } = await client.query(
    `SELECT toggles FROM autonomy_settings WHERE company_id = $1`,
    [companyId],
  );
  return (rows[0]?.toggles || {}) as Record<string, boolean>;
}

export async function isAutonomyOn(
  client: PoolClient,
  companyId: string,
  key: string,
): Promise<boolean> {
  const toggles = await getAutonomyToggles(client, companyId);
  return Boolean(toggles[key]);
}
