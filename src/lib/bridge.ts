// CRL Bridge job queue helpers — L0 lives in UI; L1/L2 claim jobs here.

import type { PoolClient } from "@neondatabase/serverless";

export async function enqueueBridgeJob(
  client: PoolClient,
  companyId: string,
  projectId: string,
  level: 1 | 2,
  payload: Record<string, unknown>,
) {
  const company = await client.query(
    `SELECT crl_bridge_enabled, crl_tos_accepted FROM companies WHERE id = $1`,
    [companyId],
  );
  const c = company.rows[0];
  if (!c?.crl_bridge_enabled || !c?.crl_tos_accepted) {
    throw new Error("CRL Bridge Level 1 is off until ToS is accepted (D4).");
  }
  const { rows } = await client.query(
    `INSERT INTO bridge_jobs (company_id, project_id, level, status, payload)
     VALUES ($1, $2, $3, 'queued', $4::jsonb) RETURNING *`,
    [companyId, projectId, level, JSON.stringify(payload)],
  );
  return rows[0];
}

export async function claimNextBridgeJob(client: PoolClient, companyId: string) {
  const { rows } = await client.query(
    `UPDATE bridge_jobs SET status = 'running', updated_at = now()
     WHERE id = (
       SELECT id FROM bridge_jobs
       WHERE company_id = $1 AND status = 'queued'
       ORDER BY created_at ASC LIMIT 1
       FOR UPDATE SKIP LOCKED
     ) RETURNING *`,
    [companyId],
  );
  return rows[0] || null;
}

export async function checkpointBridgeJob(
  client: PoolClient,
  jobId: string,
  screenshotKey: string,
) {
  await client.query(
    `UPDATE bridge_jobs SET
       status = 'paused',
       screenshot_keys = screenshot_keys || $2::jsonb,
       updated_at = now()
     WHERE id = $1`,
    [jobId, JSON.stringify([screenshotKey])],
  );
}

export async function failBridgeJob(client: PoolClient, jobId: string, error: string) {
  await client.query(
    `UPDATE bridge_jobs SET status = 'failed', error = $2, updated_at = now() WHERE id = $1`,
    [jobId, error],
  );
}

export function formatSendToCrl(project: {
  title: string;
  site_address: string;
  measurements?: Record<string, unknown> | null;
}) {
  const m = project.measurements || {};
  const lines = [
    `Project: ${project.title}`,
    `Site: ${project.site_address}`,
    `Width: ${m.width ?? ""}`,
    `Height: ${m.height ?? ""}`,
    `Notes: ${m.notes ?? ""}`,
  ];
  return lines.join("\n");
}
