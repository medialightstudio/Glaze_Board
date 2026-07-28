// Quotes list + create entry to Quote Builder.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { formatCents } from "@/lib/money";
import { CreateQuoteButton } from "./create";
import { OpsPage } from "@/components/ops/ops-page";

export default async function QuotesPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  const { quotes, projects } = await withUser(session, async (c) => {
    const quotes = await c.query(
      `SELECT q.id, q.status, q.total_cents, q.homeowner_name, q.updated_at::text,
              q.project_id, p.title AS project_title, a.name AS account_name
       FROM quotes q
       LEFT JOIN projects p ON p.id = q.project_id
       LEFT JOIN accounts a ON a.id = q.account_id
       ORDER BY q.updated_at DESC
       LIMIT 50`,
    );
    const projects = await c.query(
      `SELECT id, title FROM projects
       WHERE status IN ('measured','quote_sent','approved','lead','measure_scheduled')
       ORDER BY updated_at DESC LIMIT 40`,
    );
    return { quotes: quotes.rows, projects: projects.rows };
  });

  return (
    <OpsPage
      title="Quotes"
      purpose="Tied to a project — open the job hub from any row."
      actions={<CreateQuoteButton projects={projects} />}
    >
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
              project_id: string | null;
              project_title: string | null;
              account_name: string | null;
              homeowner_name: string | null;
            }) => (
              <li
                key={q.id}
                className="flex justify-between gap-3 rounded-lg border px-3 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/m/quotes/${q.id}`}
                    className="font-medium hover:underline"
                  >
                    {q.project_title || q.account_name || "Quote"}
                  </Link>
                  <div className="text-sm text-stone-500">
                    {q.homeowner_name || "—"} · {q.status}
                    {q.project_id ? (
                      <>
                        {" · "}
                        <Link
                          href={`/m/projects/${q.project_id}`}
                          className="underline"
                        >
                          Project
                        </Link>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="text-sm tabular-nums shrink-0">
                  {formatCents(q.total_cents || 0)}
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </OpsPage>
  );
}
