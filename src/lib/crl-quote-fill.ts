// Apply CRL quote PDF extract → quote lines + hardware BOM + project price.

import type { PoolClient } from "@neondatabase/serverless";
import type { ExtractResult } from "@/lib/ai";
import { matchExtractToOrders } from "@/lib/procure-match";
import { newShareToken, recomputeQuoteTotal } from "@/lib/quotes";

export async function applyCrlQuoteExtract(
  client: PoolClient,
  companyId: string,
  documentId: string,
  extracted: ExtractResult,
) {
  const { best } = await matchExtractToOrders(client, extracted);
  let projectId = best?.project_id || null;
  let accountId: string | null = null;

  if (projectId) {
    const p = await client.query(
      `SELECT account_id FROM projects WHERE id = $1`,
      [projectId],
    );
    accountId = p.rows[0]?.account_id || null;
    await client.query(`UPDATE documents SET project_id = $2 WHERE id = $1`, [
      documentId,
      projectId,
    ]);
  }

  const totalCents =
    extracted.total && extracted.total > 0
      ? Math.round(extracted.total > 1000 ? extracted.total : extracted.total * 100)
      : 0;

  const { rows: qrows } = await client.query(
    `INSERT INTO quotes
       (company_id, project_id, account_id, crl_quote_number, total_cents, share_token, status, terms)
     VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7) RETURNING id`,
    [
      companyId,
      projectId,
      accountId,
      extracted.quote_number || null,
      totalCents,
      newShareToken(),
      "Valid for 30 days.",
    ],
  );
  const quoteId = qrows[0].id as string;

  const lines =
    extracted.line_items?.length > 0
      ? extracted.line_items
      : extracted.hardware_bom?.map((h) => ({
          description: h.description,
          qty: h.qty || 1,
          amount_cents: 0,
        })) || [];

  let i = 0;
  for (const line of lines) {
    await client.query(
      `INSERT INTO quote_lines (company_id, quote_id, description, qty, unit_cents, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        companyId,
        quoteId,
        line.description || "Line",
        line.qty || 1,
        Math.round((line as { amount_cents?: number }).amount_cents || 0),
        i++,
      ],
    );
  }
  await recomputeQuoteTotal(client, quoteId);

  if (projectId && totalCents) {
    await client.query(
      `UPDATE projects SET quote_price_cents = $2, updated_at = now() WHERE id = $1`,
      [projectId, totalCents],
    );
  }

  if (projectId && extracted.hardware_bom?.length) {
    let hw = await client.query(
      `SELECT id FROM hardware_orders WHERE project_id = $1 ORDER BY created_at LIMIT 1`,
      [projectId],
    );
    if (!hw.rows[0]) {
      hw = await client.query(
        `INSERT INTO hardware_orders (company_id, project_id, status, items)
         VALUES ($1, $2, 'in_cart', $3::jsonb) RETURNING id`,
        [companyId, projectId, JSON.stringify(extracted.hardware_bom)],
      );
    } else {
      await client.query(
        `UPDATE hardware_orders SET items = $2::jsonb, updated_at = now() WHERE id = $1`,
        [hw.rows[0].id, JSON.stringify(extracted.hardware_bom)],
      );
    }
    const cost = extracted.total
      ? Math.round(extracted.total > 1000 ? extracted.total : extracted.total * 100)
      : null;
    if (cost != null) {
      await client.query(
        `UPDATE hardware_orders SET cost = $2 WHERE id = $1`,
        [hw.rows[0].id, cost],
      );
      await client.query(
        `UPDATE projects SET margin_hardware_cents = $2, updated_at = now() WHERE id = $1`,
        [projectId, cost],
      );
    }
  }

  return { quoteId, projectId };
}
