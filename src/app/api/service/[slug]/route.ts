// POST public service form — no auth; company from slug; systemContext insert.

import { NextResponse } from "next/server";
import { z } from "zod";
import { systemContext, withOwnerClient } from "@/lib/db-core";
import { normalizeAddress } from "@/lib/address";
import { dedupeTicket, matchTicket, proposeWarranty } from "@/lib/matching";

const schema = z.object({
  phone: z.string().min(7, "Phone is required."),
  address: z.string().min(3, "Address is required."),
  issue: z.string().min(1, "Tell us what's wrong."),
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  zip: z.string().optional(),
  turnstileToken: z.string().optional(),
});

async function verifyTurnstile(token: string | undefined) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // blank in dev — skip
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token }),
  });
  const data = (await res.json()) as { success?: boolean };
  return !!data.success;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid form." },
      { status: 400 },
    );
  }
  const data = parsed.data;
  if (!(await verifyTurnstile(data.turnstileToken))) {
    return NextResponse.json({ error: "Bot check failed." }, { status: 400 });
  }

  const company = await withOwnerClient(async (c) => {
    const { rows } = await c.query(
      `SELECT id, name FROM companies WHERE public_form_slug = $1`,
      [slug],
    );
    return rows[0] || null;
  });
  if (!company) return NextResponse.json({ error: "Form not found." }, { status: 404 });

  const norm = normalizeAddress(data.address, data.zip);
  const urgency = /leak|flood|shatter|broke|emergency/i.test(data.issue)
    ? "urgent"
    : "normal";

  const dupId = await withOwnerClient(async (c) =>
    dedupeTicket(c, company.id, data.phone, norm.address_norm),
  );
  if (dupId) {
    await withOwnerClient(async (c) => {
      await c.query(
        `UPDATE tickets SET
           issue = issue || E'\n[also via web form] ' || $1,
           updated_at = now()
         WHERE id = $2`,
        [data.issue, dupId],
      );
    });
    return NextResponse.json({ id: dupId, deduped: true });
  }

  try {
    const ticket = await systemContext(company.id, async (c) => {
      const match = await matchTicket(c, {
        address: data.address,
        zip: data.zip || norm.zip,
        phone: data.phone,
        name: data.name,
      });
      let projectId: string | null = null;
      let noMatch = false;
      if (match.kind === "project") projectId = match.projectId;
      else if (match.kind === "no_match") noMatch = true;

      let classification: string | null = null;
      if (projectId) {
        const p = await c.query(
          `SELECT status_timestamps->>'installed' AS installed FROM projects WHERE id = $1`,
          [projectId],
        );
        if (proposeWarranty(p.rows[0]?.installed ? new Date(p.rows[0].installed) : null)) {
          classification = "warranty";
        }
      }

      const { rows } = await c.query(
        `INSERT INTO tickets (
           company_id, status, contact_name, contact_phone, contact_email,
           address, address_norm, address_unit, zip, issue, urgency, source,
           classification, project_id, no_match
         ) VALUES ($1,'new',$2,$3,$4,$5,$6,$7,$8,$9,$10,'web_form',$11,$12,$13)
         RETURNING id, status, urgency, project_id, no_match, classification`,
        [
          company.id,
          data.name || null,
          data.phone,
          data.email || null,
          data.address,
          norm.address_norm,
          norm.address_unit,
          norm.zip,
          data.issue,
          urgency,
          classification,
          projectId,
          noMatch,
        ],
      );
      return rows[0];
    });
    return NextResponse.json({ ...ticket, candidates: undefined }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not submit." },
      { status: 400 },
    );
  }
}
