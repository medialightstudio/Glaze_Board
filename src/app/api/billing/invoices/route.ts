// On-demand invoice create — human tap only (DEC-10).

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { transition } from "@/lib/status-machine";
import { qbConfigured, qbCreateInvoice } from "@/lib/quickbooks";

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await req.json() as any;
  const accountId = String(body.account_id || "");
  const projectIds: string[] = Array.isArray(body.project_ids) ? body.project_ids.map(String) : [];
  if (!accountId || projectIds.length === 0) {
    return NextResponse.json({ error: "account_id and project_ids required." }, { status: 400 });
  }

  try {
    const invoice = await withUser(session, async (c) => {
      const projects = await c.query(
        `SELECT id, title, quote_price_cents, status FROM projects
         WHERE account_id = $1 AND id = ANY($2::uuid[])`,
        [accountId, projectIds],
      );
      if (projects.rows.length === 0) throw new Error("No matching projects.");

      let total = 0;
      const lines: { project_id: string; description: string; amount_cents: number }[] = [];
      for (const p of projects.rows) {
        const amount = Number(p.quote_price_cents) || 0;
        total += amount;
        lines.push({
          project_id: p.id,
          description: p.title,
          amount_cents: amount,
        });
      }

      const { rows } = await c.query(
        `INSERT INTO invoices
           (company_id, account_id, kind, status, total_cents, balance_cents, sent_at)
         VALUES ($1, $2, 'final', 'sent', $3, $3, now()) RETURNING *`,
        [session.companyId, accountId, total],
      );
      const inv = rows[0];
      for (const line of lines) {
        await c.query(
          `INSERT INTO invoice_lines (company_id, invoice_id, project_id, description, amount_cents)
           VALUES ($1, $2, $3, $4, $5)`,
          [session.companyId, inv.id, line.project_id, line.description, line.amount_cents],
        );
        if (projects.rows.find((p: { id: string; status: string }) => p.id === line.project_id)?.status === "installed") {
          await transition(c, session, line.project_id, "invoiced", {
            kind: "office",
            userId: session.userId,
          });
        }
      }

      let qbInvoiceId: string | null = null;
      if (qbConfigured()) {
        const qb = await c.query(`SELECT * FROM qb_connections WHERE company_id = $1`, [
          session.companyId,
        ]);
        const acct = await c.query(`SELECT qb_customer_id, name FROM accounts WHERE id = $1`, [
          accountId,
        ]);
        if (qb.rows[0]?.access_token && qb.rows[0]?.realm_id && acct.rows[0]?.qb_customer_id) {
          try {
            const created = await qbCreateInvoice(
              qb.rows[0].realm_id,
              qb.rows[0].access_token,
              acct.rows[0].qb_customer_id,
              lines.map((l) => ({
                description: l.description,
                amountDollars: l.amount_cents / 100,
              })),
            );
            qbInvoiceId = created.Invoice?.Id || null;
            if (qbInvoiceId) {
              await c.query(`UPDATE invoices SET qb_invoice_id = $2 WHERE id = $1`, [
                inv.id,
                qbInvoiceId,
              ]);
            }
          } catch (err) {
            await c.query(
              `INSERT INTO qb_sync_log (company_id, kind, payload, ok)
               VALUES ($1, 'invoice', $2::jsonb, false)`,
              [
                session.companyId,
                JSON.stringify({ error: err instanceof Error ? err.message : "qb error" }),
              ],
            );
          }
        }
      }

      return { ...inv, qb_invoice_id: qbInvoiceId };
    });
    return NextResponse.json(invoice, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed." },
      { status: 400 },
    );
  }
}
