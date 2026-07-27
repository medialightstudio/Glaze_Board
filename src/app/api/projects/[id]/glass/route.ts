// POST prepare / advance / remake glass orders. PO GF-{YYYY}-{NNNN}; mailto on prepare.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { maybeFireGate } from "@/lib/status-machine";

const NEXT: Record<string, string> = {
  not_ordered: "po_sent",
  po_sent: "acknowledged",
  acknowledged: "shipped",
  shipped: "received",
};

async function nextPo(client: import("@neondatabase/serverless").PoolClient, companyId: string) {
  const year = new Date().getFullYear();
  const { rows } = await client.query(
    `INSERT INTO po_sequences (company_id, year, last_n)
     VALUES ($1, $2, 1)
     ON CONFLICT (company_id) DO UPDATE SET
       year = CASE WHEN po_sequences.year = EXCLUDED.year THEN po_sequences.year ELSE EXCLUDED.year END,
       last_n = CASE WHEN po_sequences.year = EXCLUDED.year THEN po_sequences.last_n + 1 ELSE 1 END
     RETURNING year, last_n`,
    [companyId, year],
  );
  const n = String(rows[0].last_n).padStart(4, "0");
  return `GF-${rows[0].year}-${n}`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id: projectId } = await params;
  const body = (await req.json()) as Record<string, any>;
  const action = String(body.action || "advance");

  try {
    const result = await withUser(session, async (c) => {
      const proj = await c.query(`SELECT id, site_address, title FROM projects WHERE id = $1`, [
        projectId,
      ]);
      if (!proj.rows[0]) throw new Error("Project not found.");
      const site = proj.rows[0].site_address as string;

      if (action === "prepare") {
        const po = await nextPo(c, session.companyId);
        const status = body.mark_sent ? "po_sent" : "not_ordered";
        const lines = body.line_items || [];
        const { rows } = await c.query(
          `INSERT INTO glass_orders (company_id, project_id, status, po_number, line_items)
           VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *`,
          [session.companyId, projectId, status, po, JSON.stringify(lines)],
        );
        const block = (lines as { qty?: string; size?: string; glass_type?: string; note?: string }[])
          .map((l) => `${l.qty || 1} × ${l.size || "?"} ${l.glass_type || ""}${l.note ? ` — ${l.note}` : ""}`)
          .join("\n");
        const subject = `PO ${po} — ${site}`;
        const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(block || subject)}`;
        return { order: rows[0], mailto, po_number: po };
      }

      if (action === "remake") {
        const parentId = String(body.order_id || "");
        const parent = await c.query(
          `SELECT * FROM glass_orders WHERE id = $1 AND project_id = $2`,
          [parentId, projectId],
        );
        if (!parent.rows[0]) throw new Error("Glass order not found.");
        if (parent.rows[0].status !== "received") {
          throw new Error("Remake only from a received order.");
        }
        const po = await nextPo(c, session.companyId);
        const { rows } = await c.query(
          `INSERT INTO glass_orders
             (company_id, project_id, status, po_number, line_items, parent_order_id, remake_reason)
           VALUES ($1,$2,'not_ordered',$3,$4::jsonb,$5,$6) RETURNING *`,
          [
            session.companyId,
            projectId,
            po,
            JSON.stringify(parent.rows[0].line_items || []),
            parentId,
            body.reason || null,
          ],
        );
        return { order: rows[0], po_number: po };
      }

      // advance
      const orderId = String(body.order_id || "");
      const cur = await c.query(
        `SELECT * FROM glass_orders WHERE id = $1 AND project_id = $2`,
        [orderId, projectId],
      );
      if (!cur.rows[0]) throw new Error("Glass order not found.");
      const to = body.to || NEXT[cur.rows[0].status];
      if (!to) throw new Error("Can't advance further.");
      if (to === "not_needed") {
        const { rows } = await c.query(
          `UPDATE glass_orders SET status = 'not_needed', updated_at = now() WHERE id = $1 RETURNING *`,
          [orderId],
        );
        await maybeFireGate(c, session, projectId);
        return { order: rows[0] };
      }
      const { rows } = await c.query(
        `UPDATE glass_orders SET
           status = $1,
           supplier_order_number = COALESCE($2, supplier_order_number),
           price = COALESCE($3, price),
           promised_date = COALESCE($4::date, promised_date),
           received_at = CASE WHEN $1 = 'received' THEN now() ELSE received_at END,
           updated_at = now()
         WHERE id = $5 RETURNING *`,
        [to, body.supplier_order_number || null, body.price ?? null, body.promised_date || null, orderId],
      );
      await maybeFireGate(c, session, projectId);
      return { order: rows[0] };
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Glass update failed." },
      { status: 400 },
    );
  }
}
