// Quotes list + create entry to Quote Builder.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { formatCents } from "@/lib/money";
import { CreateQuoteButton } from "./create";

export default async function QuotesPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  const quotes = await withUser(session, async (c) => {
    const { rows } = await c.query(
      `SELECT q.id, q.status, q.total_cents, q.homeowner_name, q.updated_at::text,
              p.title AS project_title, a.name AS account_name
       FROM quotes q
       LEFT JOIN projects p ON p.id = q.project_id
       LEFT JOIN accounts a ON a.id = q.account_id
       ORDER BY q.updated_at DESC
       LIMIT 50`,
    );
    return rows;
  });

  return (
    <div className="p-4 max-w-3xl space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Quotes</h1>
          <p className="text-sm text-stone-500">Customer-facing documents. CRL keeps the design math.</p>
        </div>
        <CreateQuoteButton />
      </header>

      <p className="text-xs rounded border border-dashed px-3 py-2 text-stone-500">
        Contractor-side quote link — coming later (D5). Disabled placeholder.
      </p>

      {quotes.length === 0 ? (
        <p className="text-stone-600 py-8 text-center">No quotes yet.</p>
      ) : (
        <ul className="space-y-2">
          {quotes.map(
            (q: {
              id: string;
              status: string;
              total_cents: number;
              project_title: string | null;
              account_name: string | null;
              homeowner_name: string | null;
            }) => (
              <li key={q.id}>
                <Link
                  href={`/m/quotes/${q.id}`}
                  className="flex justify-between gap-3 rounded-lg border px-3 py-3 hover:bg-stone-50"
                >
                  <div>
                    <div className="font-medium">
                      {q.project_title || q.account_name || "Quote"}
                    </div>
                    <div className="text-sm text-stone-500">
                      {q.homeowner_name || "—"} · {q.status}
                    </div>
                  </div>
                  <div className="text-sm tabular-nums">{formatCents(q.total_cents || 0)}</div>
                </Link>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
