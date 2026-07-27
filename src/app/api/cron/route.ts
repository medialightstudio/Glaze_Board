// Cloudflare cron entry — mail poll (*/10) + morning digest (14:00 UTC ≈ 7am PT).

import { NextResponse } from "next/server";
import { withOwnerClient } from "@/lib/db-core";
import { runCompanyDigest } from "@/lib/digest";
import { pollMailAccounts } from "@/lib/mail-ingest";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const job = url.searchParams.get("job") || "poll";

  if (job === "digest") {
    await withOwnerClient(async (c) => {
      const companies = await c.query(`SELECT id FROM companies WHERE status = 'active'`);
      for (const co of companies.rows) {
        await c.query("SELECT set_config('app.company_id', $1, true)", [co.id]);
        await c.query("SELECT set_config('app.role', 'system', true)");
        await runCompanyDigest(c, co.id);
      }
    });
    return NextResponse.json({ ok: true, job: "digest" });
  }

  if (job === "qb_payments") {
    const base = process.env.BETTER_AUTH_URL || "http://localhost:3000";
    await fetch(`${base}/api/webhooks/qb`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.QB_WEBHOOK_SECRET
          ? { "x-qb-secret": process.env.QB_WEBHOOK_SECRET }
          : {}),
      },
      body: "{}",
    });
    return NextResponse.json({ ok: true, job: "qb_payments" });
  }

  // Default: mail poll. Cloudflare cron */10 hits this; 0 14 UTC should use ?job=digest
  // (documented in docs/cloudflare-deploy.md — wire scheduled handler or external cron).
  const result = await pollMailAccounts();
  return NextResponse.json({ ok: true, job: "poll", ...result });
}
