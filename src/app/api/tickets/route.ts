// POST manual ticket (office).

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { normalizeAddress } from "@/lib/address";
import { matchTicket, proposeWarranty } from "@/lib/matching";

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await req.json()) as Record<string, any>;
  const issue = String(body.issue || "").trim();
  if (!issue) return NextResponse.json({ error: "Issue is required." }, { status: 400 });

  const address = body.address ? String(body.address) : null;
  const zip = body.zip ? String(body.zip) : null;
  const norm = address ? normalizeAddress(address, zip) : null;
  const urgency =
    body.urgency ||
    (/leak|flood|shatter|broke|emergency/i.test(issue) ? "urgent" : "normal");

  try {
    const ticket = await withUser(session, async (c) => {
      let projectId = body.project_id || null;
      let noMatch = false;
      if (!projectId) {
        const match = await matchTicket(c, {
          address,
          zip,
          phone: body.contact_phone,
          name: body.contact_name,
        });
        if (match.kind === "project") projectId = match.projectId;
        else if (match.kind === "no_match") noMatch = true;
      }

      let classification: string | null = null;
      if (projectId) {
        const p = await c.query(
          `SELECT status_timestamps->>'installed' AS installed FROM projects WHERE id = $1`,
          [projectId],
        );
        const installed = p.rows[0]?.installed;
        if (proposeWarranty(installed ? new Date(installed) : null)) {
          classification = "warranty";
        }
      }

      const { rows } = await c.query(
        `INSERT INTO tickets (
           company_id, status, contact_name, contact_phone, contact_email,
           address, address_norm, address_unit, zip, issue, urgency, source,
           classification, project_id, no_match
         ) VALUES ($1,'new',$2,$3,$4,$5,$6,$7,$8,$9,$10,'manual',$11,$12,$13)
         RETURNING *`,
        [
          session.companyId,
          body.contact_name || null,
          body.contact_phone || null,
          body.contact_email || null,
          address,
          norm?.address_norm || null,
          norm?.address_unit || null,
          norm?.zip || zip,
          issue,
          urgency,
          classification,
          projectId,
          noMatch,
        ],
      );
      return rows[0];
    });
    return NextResponse.json(ticket, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create ticket." },
      { status: 400 },
    );
  }
}
