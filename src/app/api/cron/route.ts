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

  const result = await pollMailAccounts();
  return NextResponse.json({ ok: true, job: "poll", ...result });
}
