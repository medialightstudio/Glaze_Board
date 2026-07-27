// Build the 7 a.m. digest body for a company.

import type { PoolClient } from "@neondatabase/serverless";
import { computeExceptions } from "@/lib/exceptions";
import { notifyDigest } from "@/lib/notify";

export async function runCompanyDigest(client: PoolClient, companyId: string) {
  await computeExceptions(client, companyId);

  const installs = await client.query(
    `SELECT count(*)::int AS n FROM visits
     WHERE type = 'install' AND starts_at::date = CURRENT_DATE AND completed_at IS NULL`,
  );
  const promised = await client.query(
    `SELECT p.title FROM glass_orders g
     JOIN projects p ON p.id = g.project_id
     WHERE g.promised_date::date = CURRENT_DATE + 1 LIMIT 5`,
  );
  const exceptions = await client.query(
    `SELECT summary FROM exceptions WHERE resolved = false ORDER BY created_at DESC LIMIT 8`,
  );

  const parts = [
    `${installs.rows[0]?.n || 0} installs today`,
    ...promised.rows.map((r: { title: string }) => `Glass promised soon: ${r.title}`),
    ...exceptions.rows.map((r: { summary: string }) => r.summary),
  ];
  const body = parts.join(" · ") || "Nothing needs you. Enjoy it.";

  const admins = await client.query(
    `SELECT id, email FROM "user"
     WHERE company_id = $1 AND role IN ('admin','manager') AND active = true`,
    [companyId],
  );
  for (const u of admins.rows) {
    await notifyDigest(client, companyId, {
      userId: u.id,
      email: u.email,
      subject: "Glaze Board morning digest",
      body,
    });
  }
  return body;
}
