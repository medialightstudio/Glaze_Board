// Create / list quotes.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { newShareToken } from "@/lib/quotes";

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const projectId = body.project_id ? String(body.project_id) : null;
  const accountId = body.account_id ? String(body.account_id) : null;

  const quote = await withUser(session, async (c) => {
    let acct = accountId;
    let homeowner: string | null = null;
    if (projectId) {
      const p = await c.query(
        `SELECT account_id, title FROM projects WHERE id = $1`,
        [projectId],
      );
      if (p.rows[0]) {
        acct = acct || p.rows[0].account_id;
        homeowner = p.rows[0].title;
      }
    }
    const { rows } = await c.query(
      `INSERT INTO quotes
         (company_id, project_id, account_id, homeowner_name, terms, share_token, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'draft') RETURNING *`,
      [
        session.companyId,
        projectId,
        acct,
        homeowner,
        "Valid for 30 days. Deposit may be required before ordering.",
        newShareToken(),
      ],
    );
    return rows[0];
  });

  return NextResponse.json(quote, { status: 201 });
}
