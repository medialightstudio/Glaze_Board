// On-demand invoice create — human tap only (DEC-10). Supports deposits + COs.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { transition } from "@/lib/status-machine";
import { qbConfigured, qbCreateInvoice } from "@/lib/quickbooks";
import { ensureQbCustomerId, getFreshQbConnection } from "@/lib/qb-session";

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await req.json()) as {
    account_id?: string;
    project_ids?: string[];
    kind?: string;
    deposit_percent?: number;
  };
  const accountId = String(body.account_id || "");
  const projectIds: string[] = Array.isArray(body.project_ids)
    ? body.project_ids.map(String)
    : [];
  const kind = body.kind === "deposit" ? "deposit" : "final";
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

      const lines: { project_id: string; description: string; amount_cents: number }[] = [];
      let total = 0;
      for (const p of projects.rows) {
        let amount = Number(p.quote_price_cents) || 0;
        const cos = await c.query(
          `SELECT description, amount_cents FROM change_orders WHERE project_id = $1`,
          [p.id],
        );
        for (const co of cos.rows) {
          amount += Number(co.amount_cents) || 0;
        }
        if (kind === "deposit") {
          const pct = Number(body.deposit_percent) || 50;
          amount = Math.round((amount * pct) / 100);
        } else {
          // Apply prior deposits as credit lines
          const deps = await c.query(
            `SELECT amount_cents FROM deposits WHERE project_id = $1`,
            [p.id],
          );
          for (const d of deps.rows) {
            lines.push({
              project_id: p.id,
              description: `Deposit credit — ${p.title}`,
              amount_cents: -Math.abs(Number(d.amount_cents) || 0),
            });
            total -= Math.abs(Number(d.amount_cents) || 0);
          }
        }
        lines.push({
          project_id: p.id,
          description: p.title,
          amount_cents: amount,
        });
        total += amount;
      }

      const { rows } = await c.query(
        `INSERT INTO invoices
           (company_id, account_id, kind, status, total_cents, balance_cents, sent_at)
         VALUES ($1, $2, $3, 'sent', $4, $4, now()) RETURNING *`,
        [session.companyId, accountId, kind, total],
      );
      const inv = rows[0];
      for (const line of lines) {
        await c.query(
          `INSERT INTO invoice_lines (company_id, invoice_id, project_id, description, amount_cents)
           VALUES ($1, $2, $3, $4, $5)`,
          [session.companyId, inv.id, line.project_id, line.description, line.amount_cents],
        );
      }

      if (kind === "deposit") {
        for (const p of projects.rows) {
          const line = lines.find((l) => l.project_id === p.id && l.amount_cents > 0);
          if (!line) continue;
          await c.query(
            `INSERT INTO deposits (company_id, project_id, invoice_id, percent, amount_cents)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              session.companyId,
              p.id,
              inv.id,
              Number(body.deposit_percent) || 50,
              line.amount_cents,
            ],
          );
        }
      } else {
        for (const p of projects.rows) {
          if (p.status === "installed") {
            await transition(c, session, p.id, "invoiced", {
              kind: "office",
              userId: session.userId,
            });
          }
        }
      }

      let qbInvoiceId: string | null = null;
      let paymentLink: string | null = null;
      if (qbConfigured()) {
        try {
          const qbCustomerId = await ensureQbCustomerId(c, session.companyId, accountId);
          const conn = await getFreshQbConnection(c, session.companyId);
          if (conn) {
            const created = await qbCreateInvoice(
              conn.realm_id,
              conn.access_token,
              qbCustomerId,
              lines
                .filter((l) => l.amount_cents !== 0)
                .map((l) => ({
                  description: l.description,
                  amountDollars: l.amount_cents / 100,
                })),
            );
            qbInvoiceId = created.Invoice?.Id || null;
            paymentLink = created.Invoice?.InvoiceLink || null;
            if (qbInvoiceId) {
              await c.query(
                `UPDATE invoices SET qb_invoice_id = $2, payment_link = $3 WHERE id = $1`,
                [inv.id, qbInvoiceId, paymentLink],
              );
            }
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

      return { ...inv, qb_invoice_id: qbInvoiceId, payment_link: paymentLink };
    });
    return NextResponse.json(invoice, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed." },
      { status: 400 },
    );
  }
}
