// Update quote fields / lines / generate PDF / mark sent.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { getDocsBucket, objectKey } from "@/lib/storage";
import { buildQuotePdf } from "@/lib/pdf/quote-pdf";
import { listQuoteLines, recomputeQuoteTotal, getQuote } from "@/lib/quotes";
import { transition } from "@/lib/status-machine";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const body = await req.json() as any;

  try {
    const result = await withUser(session, async (c) => {
      const quote = await getQuote(c, id);
      if (!quote) throw new Error("Quote not found.");

      if (body.homeowner_name !== undefined || body.terms !== undefined || body.project_id) {
        await c.query(
          `UPDATE quotes SET
             homeowner_name = COALESCE($2, homeowner_name),
             terms = COALESCE($3, terms),
             project_id = COALESCE($4::uuid, project_id),
             account_id = COALESCE($5::uuid, account_id),
             crl_quote_number = COALESCE($6, crl_quote_number),
             updated_at = now()
           WHERE id = $1`,
          [
            id,
            body.homeowner_name ?? null,
            body.terms ?? null,
            body.project_id || null,
            body.account_id || null,
            body.crl_quote_number ?? null,
          ],
        );
      }

      if (Array.isArray(body.lines)) {
        await c.query(`DELETE FROM quote_lines WHERE quote_id = $1`, [id]);
        let i = 0;
        for (const line of body.lines) {
          await c.query(
            `INSERT INTO quote_lines (company_id, quote_id, description, qty, unit_cents, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              session.companyId,
              id,
              String(line.description || "Line"),
              Number(line.qty) || 1,
              Math.round(Number(line.unit_cents) || 0),
              i++,
            ],
          );
        }
        await recomputeQuoteTotal(c, id);
      }

      if (body.action === "generate_pdf") {
        const q = await getQuote(c, id);
        const lines = await listQuoteLines(c, id);
        const company = await c.query(`SELECT name, branding FROM companies WHERE id = $1`, [
          session.companyId,
        ]);
        const account = q.account_id
          ? await c.query(`SELECT name FROM accounts WHERE id = $1`, [q.account_id])
          : { rows: [] as { name: string }[] };
        const project = q.project_id
          ? await c.query(`SELECT site_address, title FROM projects WHERE id = $1`, [q.project_id])
          : { rows: [] as { site_address: string; title: string }[] };

        const bytes = await buildQuotePdf({
          companyName: company.rows[0]?.name || "Glaze Board",
          customerName: account.rows[0]?.name || project.rows[0]?.title || "Customer",
          homeownerName: q.homeowner_name,
          siteAddress: project.rows[0]?.site_address,
          terms: q.terms,
          lines,
          totalCents: q.total_cents || 0,
        });

        const fileName = `quote-${id.slice(0, 8)}.pdf`;
        const { rows } = await c.query(
          `INSERT INTO documents (company_id, file, type, mime, size, project_id, source)
           VALUES ($1, $2, 'quote', 'application/pdf', $3, $4, 'quote_builder') RETURNING id`,
          [session.companyId, fileName, bytes.length, q.project_id],
        );
        const docId = rows[0].id;
        const bucket = await getDocsBucket();
        await bucket.put(objectKey(session.companyId, docId, fileName), bytes, {
          httpMetadata: { contentType: "application/pdf" },
        });
        await c.query(
          `UPDATE quotes SET pdf_document_id = $2, status = 'ready', updated_at = now() WHERE id = $1`,
          [id, docId],
        );
        return { ok: true, pdf_document_id: docId };
      }

      if (body.action === "send") {
        // Human-tapped only — we mark sent; actual email is prepare-only via draft.
        await c.query(
          `UPDATE quotes SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = $1`,
          [id],
        );
        const q = await getQuote(c, id);
        if (q.project_id) {
          const proj = await c.query(`SELECT status FROM projects WHERE id = $1`, [q.project_id]);
          if (["lead", "measure_scheduled", "measured"].includes(proj.rows[0]?.status)) {
            await transition(c, session, q.project_id, "quote_sent", {
              kind: "office",
              userId: session.userId,
            });
          }
          if (q.total_cents) {
            await c.query(
              `UPDATE projects SET quote_price_cents = $2, updated_at = now() WHERE id = $1`,
              [q.project_id, q.total_cents],
            );
          }
        }
        return { ok: true, share_token: q.share_token };
      }

      return { ok: true };
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed." },
      { status: 400 },
    );
  }
}
