// Four reports — jobs by status, cycle time, unpaid by customer, per-job margin.

import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { formatCents, marginCents } from "@/lib/money";

export default async function ReportsPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  const data = await withUser(session, async (c) => {
    const byStatus = await c.query(
      `SELECT status, count(*)::int AS n FROM projects GROUP BY status ORDER BY n DESC`,
    );
    const cycle = await c.query(
      `SELECT avg(
         EXTRACT(EPOCH FROM (
           COALESCE((status_timestamps->>'installed')::timestamptz, now())
           - COALESCE((status_timestamps->>'lead')::timestamptz, created_at)
         )) / 86400.0
       )::numeric(10,1) AS days
       FROM projects WHERE status IN ('installed','invoiced','paid')`,
    );
    const unpaid = await c.query(
      `SELECT a.name, COALESCE(SUM(i.balance_cents),0)::int AS balance
       FROM accounts a
       LEFT JOIN invoices i ON i.account_id = a.id AND i.status <> 'void'
       GROUP BY a.id, a.name
       HAVING COALESCE(SUM(i.balance_cents),0) > 0
       ORDER BY balance DESC`,
    );
    const margins = await c.query(
      `SELECT title, quote_price_cents, margin_glass_cents, margin_hardware_cents
       FROM projects
       WHERE quote_price_cents IS NOT NULL
       ORDER BY updated_at DESC LIMIT 20`,
    );
    return {
      byStatus: byStatus.rows,
      cycleDays: cycle.rows[0]?.days,
      unpaid: unpaid.rows,
      margins: margins.rows,
    };
  });

  return (
    <div className="p-4 max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-sm text-stone-500">The four numbers that matter — not trend charts.</p>
      </header>

      <section>
        <h2 className="text-sm font-medium uppercase text-stone-500 mb-2">Jobs by status</h2>
        <ul className="grid grid-cols-2 gap-2">
          {data.byStatus.map((r: { status: string; n: number }) => (
            <li key={r.status} className="rounded border px-3 py-2 text-sm flex justify-between">
              <span>{r.status.replace(/_/g, " ")}</span>
              <span className="tabular-nums font-medium">{r.n}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase text-stone-500 mb-2">Cycle time</h2>
        <p className="text-2xl font-semibold tabular-nums">
          {data.cycleDays != null ? `${data.cycleDays} days` : "—"}
        </p>
        <p className="text-xs text-stone-500">Average lead → installed</p>
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase text-stone-500 mb-2">Unpaid by customer</h2>
        <ul className="space-y-1">
          {data.unpaid.length === 0 ? (
            <li className="text-sm text-stone-500">None</li>
          ) : (
            data.unpaid.map((r: { name: string; balance: number }) => (
              <li key={r.name} className="flex justify-between text-sm border-b py-2">
                <span>{r.name}</span>
                <span className="tabular-nums">{formatCents(r.balance)}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase text-stone-500 mb-2">Per-job margin</h2>
        <ul className="space-y-1">
          {data.margins.map(
            (r: {
              title: string;
              quote_price_cents: number;
              margin_glass_cents: number;
              margin_hardware_cents: number;
            }) => (
              <li key={r.title} className="flex justify-between text-sm border-b py-2 gap-3">
                <span className="truncate">{r.title}</span>
                <span className="tabular-nums">
                  {formatCents(
                    marginCents(
                      r.quote_price_cents || 0,
                      r.margin_glass_cents || 0,
                      r.margin_hardware_cents || 0,
                    ),
                  )}
                </span>
              </li>
            ),
          )}
        </ul>
      </section>
    </div>
  );
}
