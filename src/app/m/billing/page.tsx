// Billing door #2 — pick customer, toggle unbilled jobs, create invoice.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { formatCents } from "@/lib/money";
import { BillingForm } from "./form";
import { OpsPage, OpsSection } from "@/components/ops/ops-page";

export default async function BillingPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  const data = await withUser(session, async (c) => {
    const accounts = await c.query(
      `SELECT a.id, a.name,
              COALESCE(SUM(i.balance_cents) FILTER (WHERE i.status <> 'void'), 0)::int AS unpaid
       FROM accounts a
       LEFT JOIN invoices i ON i.account_id = a.id
       GROUP BY a.id, a.name
       ORDER BY a.name`,
    );
    const unbilled = await c.query(
      `SELECT p.id, p.title, p.account_id, p.quote_price_cents, a.name AS account_name
       FROM projects p
       JOIN accounts a ON a.id = p.account_id
       WHERE p.status = 'installed'
         AND NOT EXISTS (
           SELECT 1 FROM invoice_lines il
           JOIN invoices inv ON inv.id = il.invoice_id
           WHERE il.project_id = p.id AND inv.status <> 'void'
         )
       ORDER BY a.name, p.title`,
    );
    const qb = await c.query(`SELECT connected_at, product FROM qb_connections WHERE company_id = $1`, [
      session.companyId,
    ]);
    return {
      accounts: accounts.rows,
      unbilled: unbilled.rows,
      qb: qb.rows[0] || null,
    };
  });

  return (
    <OpsPage
      title="Billing"
      purpose={
        data.qb?.connected_at
          ? `On demand only. QuickBooks ${data.qb.product} connected.`
          : "On demand only — QuickBooks not connected yet."
      }
    >
      <OpsSection title="Unpaid by customer">
        <ul className="space-y-1">
          {data.accounts
            .filter((a: { unpaid: number }) => a.unpaid > 0)
            .map((a: { id: string; name: string; unpaid: number }) => (
              <li
                key={a.id}
                className="flex justify-between text-sm border-b py-2"
              >
                <Link href={`/m/customers/${a.id}`} className="underline">
                  {a.name}
                </Link>
                <span className="tabular-nums">{formatCents(a.unpaid)}</span>
              </li>
            ))}
          {data.accounts.every((a: { unpaid: number }) => a.unpaid === 0) ? (
            <li className="text-sm text-stone-500">No unpaid balances.</li>
          ) : null}
        </ul>
      </OpsSection>

      <OpsSection title="Unbilled installs">
        <ul className="space-y-1 mb-3">
          {data.unbilled.map(
            (p: { id: string; title: string; quote_price_cents: number | null }) => (
              <li
                key={p.id}
                className="flex justify-between text-sm border-b py-2"
              >
                <Link href={`/m/projects/${p.id}`} className="underline">
                  {p.title}
                </Link>
                <span className="tabular-nums">
                  {formatCents(p.quote_price_cents || 0)}
                </span>
              </li>
            ),
          )}
          {data.unbilled.length === 0 ? (
            <li className="text-sm text-stone-500">None waiting.</li>
          ) : null}
        </ul>
        <BillingForm
          unbilled={data.unbilled.map(
            (p: {
              id: string;
              title: string;
              account_id: string;
              account_name: string;
              quote_price_cents: number | null;
            }) => ({
              id: p.id,
              title: p.title,
              account_id: p.account_id,
              account_name: p.account_name,
              amount_cents: p.quote_price_cents || 0,
            }),
          )}
        />
      </OpsSection>
    </OpsPage>
  );
}
