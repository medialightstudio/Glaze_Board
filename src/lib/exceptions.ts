// Exception sweep — overdue acks, promised dates, aging quotes, will-call, unbilled.

import type { PoolClient } from "@neondatabase/serverless";

export async function computeExceptions(client: PoolClient, companyId: string) {
  const created: string[] = [];

  async function upsert(projectId: string | null, kind: string, summary: string) {
    const existing = await client.query(
      `SELECT id FROM exceptions
       WHERE company_id = $1 AND kind = $2 AND resolved = false
         AND (($3::uuid IS NULL AND project_id IS NULL) OR project_id = $3)
       LIMIT 1`,
      [companyId, kind, projectId],
    );
    if (existing.rows[0]) return;
    await client.query(
      `INSERT INTO exceptions (company_id, project_id, kind, summary)
       VALUES ($1, $2, $3, $4)`,
      [companyId, projectId, kind, summary],
    );
    created.push(kind);
  }

  const overdueAck = await client.query(
    `SELECT g.project_id, p.title FROM glass_orders g
     JOIN projects p ON p.id = g.project_id
     WHERE g.status = 'ordered'
       AND g.updated_at < now() - interval '2 days'`,
  );
  for (const r of overdueAck.rows) {
    await upsert(r.project_id, "overdue_ack", `No acknowledgment yet for ${r.title}`);
  }

  const promised = await client.query(
    `SELECT g.project_id, p.title, g.promised_date FROM glass_orders g
     JOIN projects p ON p.id = g.project_id
     WHERE g.promised_date IS NOT NULL AND g.promised_date::date < CURRENT_DATE
       AND g.status NOT IN ('received','cancelled')`,
  );
  for (const r of promised.rows) {
    await upsert(r.project_id, "promised_passed", `Promised date passed — ${r.title}`);
  }

  const aging = await client.query(
    `SELECT id, title FROM projects
     WHERE status = 'quote_sent'
       AND COALESCE((status_timestamps->>'quote_sent')::timestamptz, updated_at)
           < now() - interval '7 days'`,
  );
  for (const r of aging.rows) {
    await upsert(r.id, "aging_quote", `Quote aging ≥7 days — ${r.title}`);
  }

  const willCall = await client.query(
    `SELECT h.project_id, p.title FROM hardware_orders h
     JOIN projects p ON p.id = h.project_id
     WHERE h.status = 'ordered' AND COALESCE(h.fulfillment, '') = 'will_call'
       AND h.updated_at < now() - interval '3 days'`,
  );
  for (const r of willCall.rows) {
    await upsert(r.project_id, "will_call_sitting", `Will-call sitting >3 days — ${r.title}`);
  }

  const unbilled = await client.query(
    `SELECT a.id, a.name, count(p.id)::int AS n
     FROM accounts a
     JOIN projects p ON p.account_id = a.id
     WHERE a.billing_type = 'monthly'
       AND p.status = 'installed'
     GROUP BY a.id, a.name`,
  );
  for (const r of unbilled.rows) {
    await upsert(null, "unbilled_monthly", `${r.name}: ${r.n} completed unbilled (reminder only)`);
  }

  return created;
}
