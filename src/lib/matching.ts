// Ticket → project matching: exact address, then phone, then fuzzy name top-3, else no_match.

import type { PoolClient } from "@neondatabase/serverless";
import { normalizeAddress, addressesMatch } from "@/lib/address";

export type MatchResult =
  | { kind: "project"; projectId: string; via: "address" | "phone" }
  | { kind: "candidates"; projectIds: string[] }
  | { kind: "no_match" };

export async function matchTicket(
  client: PoolClient,
  input: {
    address?: string | null;
    zip?: string | null;
    phone?: string | null;
    name?: string | null;
  },
): Promise<MatchResult> {
  if (input.address) {
    const norm = normalizeAddress(input.address, input.zip);
    const { rows } = await client.query(
      `SELECT id, address_norm, address_unit, zip FROM projects WHERE address_norm = $1`,
      [norm.address_norm],
    );
    for (const row of rows) {
      if (
        addressesMatch(norm, {
          address_norm: row.address_norm,
          address_unit: row.address_unit,
          zip: row.zip,
        })
      ) {
        return { kind: "project", projectId: row.id, via: "address" };
      }
    }
  }

  if (input.phone) {
    const digits = input.phone.replace(/\D/g, "");
    const { rows } = await client.query(
      `SELECT DISTINCT p.id
       FROM projects p
       JOIN project_contacts pc ON pc.project_id = p.id
       JOIN contacts c ON c.id = pc.contact_id
       WHERE regexp_replace(coalesce(c.phone, ''), '\\D', '', 'g') = $1
       LIMIT 2`,
      [digits],
    );
    if (rows.length === 1) {
      return { kind: "project", projectId: rows[0].id, via: "phone" };
    }
  }

  if (input.name) {
    const { rows } = await client.query(
      `SELECT p.id FROM projects p
       JOIN accounts a ON a.id = p.account_id
       WHERE a.name % $1 OR a.name ILIKE $2
       ORDER BY similarity(a.name, $1) DESC NULLS LAST
       LIMIT 3`,
      [input.name, `%${input.name}%`],
    );
    if (rows.length > 0) {
      return { kind: "candidates", projectIds: rows.map((r) => r.id) };
    }
  }

  return { kind: "no_match" };
}

export async function dedupeTicket(
  client: PoolClient,
  companyId: string,
  phone: string | null,
  addressNorm: string | null,
) {
  const { rows } = await client.query(
    `SELECT id FROM tickets
     WHERE company_id = $1
       AND created_at > now() - interval '48 hours'
       AND (
         ($2::text IS NOT NULL AND regexp_replace(coalesce(contact_phone,''), '\\D', '', 'g')
            = regexp_replace($2, '\\D', '', 'g'))
         OR ($3::text IS NOT NULL AND address_norm = $3)
       )
     ORDER BY created_at DESC LIMIT 1`,
    [companyId, phone, addressNorm],
  );
  return rows[0]?.id as string | undefined;
}

export function proposeWarranty(installDate: Date | null): boolean {
  if (!installDate) return false;
  const yearMs = 365 * 24 * 60 * 60 * 1000;
  return Date.now() - installDate.getTime() <= yearMs;
}
