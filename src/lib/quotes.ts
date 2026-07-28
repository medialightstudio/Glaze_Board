// Quote Builder helpers — lines, totals, share tokens.

import type { PoolClient } from "@neondatabase/serverless";
import { randomBytes } from "crypto";

export function newShareToken() {
  return randomBytes(16).toString("hex");
}

export async function getQuote(client: PoolClient, id: string) {
  const { rows } = await client.query(`SELECT * FROM quotes WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function listQuoteLines(client: PoolClient, quoteId: string) {
  const { rows } = await client.query(
    `SELECT * FROM quote_lines WHERE quote_id = $1 ORDER BY sort_order, id`,
    [quoteId],
  );
  return rows as {
    id: string;
    description: string;
    qty: number;
    unit_cents: number;
  }[];
}

export function totalFromLines(lines: { qty: number; unit_cents: number }[]) {
  return lines.reduce((sum, l) => sum + Math.round(Number(l.qty) * Number(l.unit_cents)), 0);
}

export async function recomputeQuoteTotal(client: PoolClient, quoteId: string) {
  const lines = await listQuoteLines(client, quoteId);
  const total = totalFromLines(lines);
  await client.query(
    `UPDATE quotes SET total_cents = $2, updated_at = now() WHERE id = $1`,
    [quoteId, total],
  );
  return total;
}
