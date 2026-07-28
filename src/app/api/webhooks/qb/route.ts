// QuickBooks payment webhook / sync hook — mark invoices paid when balance 0.

import { NextResponse } from "next/server";
import { withOwnerClient } from "@/lib/db-core";
import { getFreshQbConnection } from "@/lib/qb-session";
import { qbGetInvoice } from "@/lib/quickbooks";
import { transition } from "@/lib/status-machine";

export async function POST(req: Request) {
  const secret = process.env.QB_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-qb-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Intuit sends complex payloads; we also accept { company_id, qb_invoice_id } for tests.
  const body = (await req.json().catch(() => ({}))) as {
    company_id?: string;
    qb_invoice_id?: string;
  };

  await withOwnerClient(async (c) => {
    const companies = body.company_id
      ? [{ id: body.company_id }]
      : (await c.query(`SELECT company_id AS id FROM qb_connections`)).rows;

    for (const co of companies) {
      await c.query("SELECT set_config('app.company_id', $1, true)", [co.id]);
      await c.query("SELECT set_config('app.role', 'system', true)");
      const conn = await getFreshQbConnection(c, co.id);
      if (!conn) continue;

      const invoices = await c.query(
        `SELECT * FROM invoices
         WHERE company_id = $1 AND qb_invoice_id IS NOT NULL AND status = 'sent'
           AND ($2::text IS NULL OR qb_invoice_id = $2)`,
        [co.id, body.qb_invoice_id || null],
      );
      for (const inv of invoices.rows) {
        const remote = await qbGetInvoice(conn.realm_id, conn.access_token, inv.qb_invoice_id);
        const balance = remote?.Invoice?.Balance;
        if (balance == null) continue;
        const balanceCents = Math.round(Number(balance) * 100);
        await c.query(
          `UPDATE invoices SET balance_cents = $2,
             status = CASE WHEN $2 <= 0 THEN 'paid' ELSE status END,
             paid_at = CASE WHEN $2 <= 0 THEN now() ELSE paid_at END,
             updated_at = now()
           WHERE id = $1`,
          [inv.id, balanceCents],
        );
        if (balanceCents <= 0) {
          const lines = await c.query(
            `SELECT DISTINCT project_id FROM invoice_lines WHERE invoice_id = $1 AND project_id IS NOT NULL`,
            [inv.id],
          );
          for (const line of lines.rows) {
            const p = await c.query(`SELECT status FROM projects WHERE id = $1`, [
              line.project_id,
            ]);
            if (p.rows[0]?.status === "invoiced") {
              await transition(
                c,
                { companyId: co.id, role: "system", userId: "system" },
                line.project_id,
                "paid",
                { kind: "quickbooks" },
              );
            }
          }
        }
      }
    }
  });

  return NextResponse.json({ ok: true });
}
