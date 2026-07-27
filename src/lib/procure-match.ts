// Match extracted supplier docs to glass/hardware orders — PO primary.

import type { PoolClient } from "@neondatabase/serverless";
import type { ExtractResult } from "@/lib/ai";

export type MatchCandidate = {
  project_id: string;
  glass_order_id?: string;
  hardware_order_id?: string;
  label: string;
  score: number;
  via: string;
};

export async function matchExtractToOrders(
  client: PoolClient,
  extracted: ExtractResult,
): Promise<{ best: MatchCandidate | null; alternatives: MatchCandidate[] }> {
  const alts: MatchCandidate[] = [];
  const po = (extracted.our_po_number || "").trim();
  const supplierOrder = (extracted.order_number || "").trim();

  if (po) {
    const { rows } = await client.query(
      `SELECT g.id AS glass_order_id, g.project_id, g.po_number, p.title
       FROM glass_orders g JOIN projects p ON p.id = g.project_id
       WHERE g.po_number ILIKE $1 LIMIT 5`,
      [po],
    );
    for (const r of rows) {
      alts.push({
        project_id: r.project_id,
        glass_order_id: r.glass_order_id,
        label: `${r.title} · PO ${r.po_number}`,
        score: r.po_number.toLowerCase() === po.toLowerCase() ? 0.98 : 0.9,
        via: "po",
      });
    }
  }

  if (supplierOrder) {
    const { rows } = await client.query(
      `SELECT g.id AS glass_order_id, g.project_id, g.supplier_order_number, p.title
       FROM glass_orders g JOIN projects p ON p.id = g.project_id
       WHERE g.supplier_order_number ILIKE $1 LIMIT 3`,
      [supplierOrder],
    );
    for (const r of rows) {
      alts.push({
        project_id: r.project_id,
        glass_order_id: r.glass_order_id,
        label: `${r.title} · supplier ${r.supplier_order_number}`,
        score: 0.92,
        via: "supplier_order",
      });
    }
    const hw = await client.query(
      `SELECT h.id AS hardware_order_id, h.project_id, h.order_number, p.title
       FROM hardware_orders h JOIN projects p ON p.id = h.project_id
       WHERE h.order_number ILIKE $1 LIMIT 3`,
      [supplierOrder],
    );
    for (const r of hw.rows) {
      alts.push({
        project_id: r.project_id,
        hardware_order_id: r.hardware_order_id,
        label: `${r.title} · CRL ${r.order_number}`,
        score: 0.9,
        via: "hardware_order",
      });
    }
  }

  // Dedupe by project+via, keep highest score
  const seen = new Map<string, MatchCandidate>();
  for (const a of alts) {
    const key = `${a.project_id}:${a.glass_order_id || a.hardware_order_id || ""}`;
    const prev = seen.get(key);
    if (!prev || a.score > prev.score) seen.set(key, a);
  }
  const list = [...seen.values()].sort((a, b) => b.score - a.score);
  return { best: list[0] || null, alternatives: list.slice(0, 3) };
}

export async function applyProcurementAdvance(
  client: PoolClient,
  companyId: string,
  extracted: ExtractResult,
  match: MatchCandidate,
  documentId: string | null,
): Promise<{ advanced: boolean; from?: string; to?: string }> {
  const docType = (extracted.doc_type || "").toLowerCase();
  let to: string | null = null;
  if (docType.includes("ack")) to = "acknowledged";
  else if (docType.includes("packing") || docType.includes("ship")) to = "shipped";
  else if (docType.includes("delivery") || docType.includes("received")) to = "received";
  else if (docType.includes("order_confirmation") && match.hardware_order_id) to = "ordered";

  if (!to) return { advanced: false };

  if (match.glass_order_id) {
    const cur = await client.query(`SELECT status FROM glass_orders WHERE id = $1`, [
      match.glass_order_id,
    ]);
    const from = cur.rows[0]?.status as string;
    const price =
      extracted.total && extracted.total > 0
        ? Math.round(extracted.total > 1000 ? extracted.total : extracted.total * 100)
        : null;
    await client.query(
      `UPDATE glass_orders SET
         status = $2,
         supplier_order_number = COALESCE(NULLIF($3, ''), supplier_order_number),
         promised_date = CASE WHEN $4 <> '' THEN $4::date ELSE promised_date END,
         price = COALESCE($5, price),
         updated_at = now()
       WHERE id = $1`,
      [
        match.glass_order_id,
        to,
        extracted.order_number || "",
        extracted.promised_date || "",
        price,
      ],
    );
    if (price != null) {
      await client.query(
        `UPDATE projects SET margin_glass_cents = $2, updated_at = now() WHERE id = $1`,
        [match.project_id, price],
      );
    }
    if (documentId) {
      await client.query(
        `UPDATE documents SET project_id = $2, glass_order_id = $3 WHERE id = $1`,
        [documentId, match.project_id, match.glass_order_id],
      );
    }
    await client.query(
      `INSERT INTO activity_events (company_id, project_id, actor, verb, details)
       VALUES ($1, $2, 'email_agent', 'procurement_advanced', $3::jsonb)`,
      [
        companyId,
        match.project_id,
        JSON.stringify({
          from,
          to,
          glass_order_id: match.glass_order_id,
          document_id: documentId,
          via: match.via,
        }),
      ],
    );
    return { advanced: true, from, to };
  }

  if (match.hardware_order_id && to) {
    const cur = await client.query(`SELECT status FROM hardware_orders WHERE id = $1`, [
      match.hardware_order_id,
    ]);
    const from = cur.rows[0]?.status as string;
    const hwTo = to === "acknowledged" ? "ordered" : to === "shipped" ? "ordered" : to;
    await client.query(
      `UPDATE hardware_orders SET status = $2, order_number = COALESCE(NULLIF($3,''), order_number), updated_at = now()
       WHERE id = $1`,
      [match.hardware_order_id, hwTo, extracted.order_number || ""],
    );
    if (documentId) {
      await client.query(
        `UPDATE documents SET project_id = $2, hardware_order_id = $3 WHERE id = $1`,
        [documentId, match.project_id, match.hardware_order_id],
      );
    }
    await client.query(
      `INSERT INTO activity_events (company_id, project_id, actor, verb, details)
       VALUES ($1, $2, 'email_agent', 'procurement_advanced', $3::jsonb)`,
      [
        companyId,
        match.project_id,
        JSON.stringify({
          from,
          to: hwTo,
          hardware_order_id: match.hardware_order_id,
          document_id: documentId,
        }),
      ],
    );
    return { advanced: true, from, to: hwTo };
  }

  return { advanced: false };
}

export async function reverseProcurementAdvance(
  client: PoolClient,
  companyId: string,
  details: {
    project_id: string;
    from?: string;
    glass_order_id?: string;
    hardware_order_id?: string;
  },
) {
  if (details.glass_order_id && details.from) {
    await client.query(
      `UPDATE glass_orders SET status = $2, updated_at = now() WHERE id = $1`,
      [details.glass_order_id, details.from],
    );
  }
  if (details.hardware_order_id && details.from) {
    await client.query(
      `UPDATE hardware_orders SET status = $2, updated_at = now() WHERE id = $1`,
      [details.hardware_order_id, details.from],
    );
  }
  await client.query(
    `INSERT INTO activity_events (company_id, project_id, actor, verb, details)
     VALUES ($1, $2, 'office', 'procurement_reversed', $3::jsonb)`,
    [companyId, details.project_id, JSON.stringify(details)],
  );
}
