// Exception sweep — business-day aware where specified; company TZ for digests.

import type { PoolClient } from "@neondatabase/serverless";
import { createDraft } from "@/lib/drafts";

async function upsert(
  client: PoolClient,
  companyId: string,
  projectId: string | null,
  kind: string,
  summary: string,
) {
  const existing = await client.query(
    `SELECT id FROM exceptions
     WHERE company_id = $1 AND kind = $2 AND resolved = false
       AND (($3::uuid IS NULL AND project_id IS NULL) OR project_id = $3)
     LIMIT 1`,
    [companyId, kind, projectId],
  );
  if (existing.rows[0]) return false;
  await client.query(
    `INSERT INTO exceptions (company_id, project_id, kind, summary)
     VALUES ($1, $2, $3, $4)`,
    [companyId, projectId, kind, summary],
  );
  return true;
}

export async function computeExceptions(client: PoolClient, companyId: string) {
  const created: string[] = [];

  // Ack overdue: glass still po_sent for >2 business days (Mon–Fri)
  const overdueAck = await client.query(
    `SELECT g.project_id, p.title FROM glass_orders g
     JOIN projects p ON p.id = g.project_id
     WHERE g.status = 'po_sent'
       AND (
         SELECT count(*) FROM generate_series(
           (g.updated_at AT TIME ZONE coalesce(
             (SELECT timezone FROM companies WHERE id = $1), 'America/Los_Angeles'
           ))::date + 1,
           (now() AT TIME ZONE coalesce(
             (SELECT timezone FROM companies WHERE id = $1), 'America/Los_Angeles'
           ))::date,
           '1 day'
         ) d
         WHERE extract(dow FROM d) BETWEEN 1 AND 5
       ) >= 2`,
    [companyId],
  );
  for (const r of overdueAck.rows) {
    if (await upsert(client, companyId, r.project_id, "overdue_ack", `No acknowledgment yet for ${r.title}`)) {
      created.push("overdue_ack");
    }
  }

  const promised = await client.query(
    `SELECT g.project_id, p.title FROM glass_orders g
     JOIN projects p ON p.id = g.project_id
     WHERE g.promised_date IS NOT NULL AND g.promised_date::date < CURRENT_DATE
       AND g.status NOT IN ('received','not_needed')`,
  );
  for (const r of promised.rows) {
    if (
      await upsert(
        client,
        companyId,
        r.project_id,
        "promised_passed",
        `Promised date passed — ${r.title}`,
      )
    ) {
      created.push("promised_passed");
    }
  }

  const aging = await client.query(
    `SELECT id, title FROM projects
     WHERE status = 'quote_sent'
       AND COALESCE((status_timestamps->>'quote_sent')::timestamptz, updated_at)
           < now() - interval '7 days'`,
  );
  for (const r of aging.rows) {
    if (await upsert(client, companyId, r.id, "aging_quote", `Quote aging ≥7 days — ${r.title}`)) {
      created.push("aging_quote");
      await createDraft(client, companyId, {
        projectId: r.id,
        kind: "quote_followup",
        channel: "email",
        body: `Hi — checking in on the quote for ${r.title}. Happy to answer questions or adjust the scope.`,
      });
    }
  }

  const willCall = await client.query(
    `SELECT h.project_id, p.title FROM hardware_orders h
     JOIN projects p ON p.id = h.project_id
     WHERE h.status = 'ordered' AND COALESCE(h.fulfillment, '') = 'will_call'
       AND h.updated_at < now() - interval '3 days'`,
  );
  for (const r of willCall.rows) {
    if (
      await upsert(
        client,
        companyId,
        r.project_id,
        "will_call_sitting",
        `Will-call sitting >3 days — ${r.title}`,
      )
    ) {
      created.push("will_call_sitting");
    }
  }

  const unbilled = await client.query(
    `SELECT a.id, a.name, count(p.id)::int AS n
     FROM accounts a
     JOIN projects p ON p.account_id = a.id
     WHERE a.billing_type = 'monthly' AND p.status = 'installed'
     GROUP BY a.id, a.name`,
  );
  for (const r of unbilled.rows) {
    if (
      await upsert(
        client,
        companyId,
        null,
        "unbilled_monthly",
        `${r.name}: ${r.n} completed unbilled (reminder only)`,
      )
    ) {
      created.push("unbilled_monthly");
    }
  }

  return created;
}
