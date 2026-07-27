// Quote Builder — branding header, lines, generate/share/send.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { formatCents } from "@/lib/money";
import { QuoteEditor } from "./editor";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAppSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const data = await withUser(session, async (c) => {
    const q = await c.query(`SELECT * FROM quotes WHERE id = $1`, [id]);
    if (!q.rows[0]) return null;
    const lines = await c.query(
      `SELECT * FROM quote_lines WHERE quote_id = $1 ORDER BY sort_order`,
      [id],
    );
    const company = await c.query(`SELECT name FROM companies WHERE id = $1`, [
      session.companyId,
    ]);
    const views = await c.query(
      `SELECT count(*)::int AS n FROM quote_views WHERE quote_id = $1`,
      [id],
    );
    return {
      quote: q.rows[0],
      lines: lines.rows,
      companyName: company.rows[0]?.name || "Glaze Board",
      views: views.rows[0]?.n || 0,
    };
  });
  if (!data) notFound();

  const shareUrl = data.quote.share_token
    ? `/q/${data.quote.share_token}`
    : null;

  return (
    <div className="p-4 max-w-3xl space-y-4">
      <Link href="/m/quotes" className="text-sm text-stone-500 underline">
        ← Quotes
      </Link>

      <article className="quote-canvas rounded-lg border bg-white shadow-sm overflow-hidden">
        <header className="bg-stone-900 text-white px-6 py-8">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-300">Quote</p>
          <h1 className="text-3xl font-semibold mt-1">{data.companyName}</h1>
          <p className="text-stone-300 mt-2 text-sm">
            {data.quote.status} · {formatCents(data.quote.total_cents || 0)} · {data.views} views
          </p>
        </header>
        <div className="p-6">
          <QuoteEditor
            quoteId={id}
            initial={{
              homeowner_name: data.quote.homeowner_name || "",
              terms: data.quote.terms || "",
              project_id: data.quote.project_id || "",
              crl_quote_number: data.quote.crl_quote_number || "",
              lines: data.lines.map(
                (l: { description: string; qty: number; unit_cents: number }) => ({
                  description: l.description,
                  qty: Number(l.qty),
                  unit_cents: Number(l.unit_cents),
                }),
              ),
              pdf_document_id: data.quote.pdf_document_id,
              share_url: shareUrl,
            }}
          />
        </div>
      </article>

      <p className="text-xs text-stone-500 border border-dashed rounded px-3 py-2">
        Contractor quote page link — disabled until D5.
      </p>
    </div>
  );
}
