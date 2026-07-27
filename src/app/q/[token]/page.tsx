// Public read-only quote share — view tracked.

import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { systemContext, withOwnerClient } from "@/lib/db-core";
import { formatCents } from "@/lib/money";

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const h = await headers();
  const ua = h.get("user-agent") || "";

  // Lookup company via owner then stamp system context for RLS.
  const found = await withOwnerClient(async (c) => {
    const { rows } = await c.query(
      `SELECT id, company_id FROM quotes WHERE share_token = $1`,
      [token],
    );
    return rows[0] as { id: string; company_id: string } | undefined;
  });
  if (!found) notFound();

  const data = await systemContext(found.company_id, async (c) => {
    const q = await c.query(`SELECT * FROM quotes WHERE id = $1`, [found.id]);
    const lines = await c.query(
      `SELECT * FROM quote_lines WHERE quote_id = $1 ORDER BY sort_order`,
      [found.id],
    );
    const company = await c.query(`SELECT name FROM companies WHERE id = $1`, [
      found.company_id,
    ]);
    await c.query(
      `INSERT INTO quote_views (company_id, quote_id, user_agent) VALUES ($1, $2, $3)`,
      [found.company_id, found.id, ua.slice(0, 300)],
    );
    return {
      quote: q.rows[0],
      lines: lines.rows,
      companyName: company.rows[0]?.name || "Quote",
    };
  });

  return (
    <main className="min-h-screen bg-stone-100">
      <article className="max-w-2xl mx-auto my-8 bg-white border shadow-sm overflow-hidden">
        <header className="bg-stone-900 text-white px-6 py-10">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-300">Quote</p>
          <h1 className="text-3xl font-semibold mt-2">{data.companyName}</h1>
        </header>
        <div className="p-6 space-y-4">
          {data.quote.homeowner_name ? (
            <p className="text-sm text-stone-600">For {data.quote.homeowner_name}</p>
          ) : null}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-stone-500 border-b">
                <th className="py-2">Description</th>
                <th>Qty</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map(
                (l: { id: string; description: string; qty: number; unit_cents: number }) => (
                  <tr key={l.id} className="border-b border-stone-100">
                    <td className="py-2">{l.description}</td>
                    <td>{l.qty}</td>
                    <td className="text-right">
                      {formatCents(Math.round(Number(l.qty) * Number(l.unit_cents)))}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
          <p className="text-right text-lg font-semibold">
            Total {formatCents(data.quote.total_cents || 0)}
          </p>
          {data.quote.terms ? (
            <p className="text-sm text-stone-600 whitespace-pre-wrap">{data.quote.terms}</p>
          ) : null}
          {data.quote.pdf_document_id ? (
            <a
              className="inline-block underline text-sm"
              href={`/api/public/quote-pdf/${token}`}
            >
              Download PDF
            </a>
          ) : null}
        </div>
      </article>
    </main>
  );
}
