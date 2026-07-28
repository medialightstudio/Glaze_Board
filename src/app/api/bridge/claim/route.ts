// Bridge worker claims next queued job (shared secret).

import { NextResponse } from "next/server";
import { withOwnerClient } from "@/lib/db-core";
import { claimNextBridgeJob } from "@/lib/bridge";

export async function POST(req: Request) {
  const secret = process.env.BRIDGE_SHARED_SECRET;
  if (!secret || req.headers.get("x-bridge-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = String(body.company_id || process.env.DEFAULT_COMPANY_ID || "");
  if (!companyId) return NextResponse.json({ error: "company_id required." }, { status: 400 });

  const job = await withOwnerClient(async (c) => {
    await c.query("SELECT set_config('app.company_id', $1, true)", [companyId]);
    return claimNextBridgeJob(c, companyId);
  });
  return NextResponse.json({ job });
}
