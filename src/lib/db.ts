// Typed business helpers on top of db-core — extend here; never touch security wiring.

import type { PoolClient } from "@neondatabase/serverless";
import { normalizeAddress } from "@/lib/address";

export async function listAccounts(client: PoolClient) {
  const { rows } = await client.query(
    `SELECT * FROM accounts ORDER BY is_direct DESC, name ASC`,
  );
  return rows;
}

export async function createAccount(
  client: PoolClient,
  companyId: string,
  data: { name: string; phone?: string; email?: string; billing_type?: string },
) {
  const { rows } = await client.query(
    `INSERT INTO accounts (company_id, name, phone, email, billing_type)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      companyId,
      data.name,
      data.phone || null,
      data.email || null,
      data.billing_type || "per_job",
    ],
  );
  return rows[0];
}

export async function getAccount(client: PoolClient, id: string) {
  const { rows } = await client.query(`SELECT * FROM accounts WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function listContacts(client: PoolClient, accountId: string) {
  const { rows } = await client.query(
    `SELECT * FROM contacts WHERE account_id = $1 ORDER BY name`,
    [accountId],
  );
  return rows;
}

export async function createContact(
  client: PoolClient,
  companyId: string,
  data: { account_id: string; name: string; phone?: string; email?: string },
) {
  const { rows } = await client.query(
    `INSERT INTO contacts (company_id, account_id, name, phone, email)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [companyId, data.account_id, data.name, data.phone || null, data.email || null],
  );
  return rows[0];
}

export async function ensureDirectAccount(client: PoolClient, companyId: string) {
  const { rows } = await client.query(
    `SELECT * FROM accounts WHERE company_id = $1 AND is_direct = true LIMIT 1`,
    [companyId],
  );
  if (rows[0]) return rows[0];
  const inserted = await client.query(
    `INSERT INTO accounts (company_id, name, is_direct, billing_type)
     VALUES ($1, 'Direct', true, 'per_job') RETURNING *`,
    [companyId],
  );
  return inserted.rows[0];
}

export async function createProject(
  client: PoolClient,
  companyId: string,
  data: {
    account_id: string;
    site_address: string;
    zip?: string;
    note?: string;
    job_type?: string;
    account_name?: string;
  },
) {
  const norm = normalizeAddress(data.site_address, data.zip);
  const short = norm.address_norm || data.site_address;
  const title = `${data.account_name || "Customer"} — ${short}`;
  const { rows } = await client.query(
    `INSERT INTO projects (
       company_id, title, account_id, site_address, address_norm, address_unit, zip, status, job_type, note, status_timestamps
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,'lead',$8,$9,$10::jsonb) RETURNING *`,
    [
      companyId,
      title,
      data.account_id,
      data.site_address,
      norm.address_norm,
      norm.address_unit,
      norm.zip,
      data.job_type || null,
      data.note || null,
      JSON.stringify({ lead: new Date().toISOString() }),
    ],
  );
  return rows[0];
}

export async function listProjectsForAccount(client: PoolClient, accountId: string) {
  const { rows } = await client.query(
    `SELECT * FROM projects WHERE account_id = $1 ORDER BY created_at DESC`,
    [accountId],
  );
  return rows;
}

export async function getProject(client: PoolClient, id: string) {
  const { rows } = await client.query(`SELECT * FROM projects WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function searchAll(client: PoolClient, q: string) {
  const like = `%${q}%`;
  const projects = await client.query(
    `SELECT id, title, site_address FROM projects
     WHERE title ILIKE $1 OR site_address ILIKE $1 OR address_norm ILIKE $1
     ORDER BY updated_at DESC LIMIT 8`,
    [like],
  );
  const contacts = await client.query(
    `SELECT id, name, phone, account_id FROM contacts
     WHERE name ILIKE $1 OR phone ILIKE $1 LIMIT 8`,
    [like],
  );
  const accounts = await client.query(
    `SELECT id, name FROM accounts WHERE name ILIKE $1 LIMIT 8`,
    [like],
  );
  const glass = await client.query(
    `SELECT id, po_number, project_id FROM glass_orders WHERE po_number ILIKE $1 LIMIT 8`,
    [like],
  );
  const hardware = await client.query(
    `SELECT id, order_number, project_id FROM hardware_orders WHERE order_number ILIKE $1 LIMIT 8`,
    [like],
  );
  return {
    projects: projects.rows,
    contacts: contacts.rows,
    accounts: accounts.rows,
    glass: glass.rows,
    hardware: hardware.rows,
  };
}
