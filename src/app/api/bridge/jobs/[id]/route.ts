// Bridge worker checkpoint / fail / done.

import { NextResponse } from "next/server";
import { withOwnerClient } from "@/lib/db-core";
import { checkpointBridgeJob, failBridgeJob } from "@/lib/bridge";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const secret = process.env.BRIDGE_SHARED_SECRET;
  if (!secret || req.headers.get("x-bridge-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json() as any;
  const companyId = String(body.company_id || process.env.DEFAULT_COMPANY_ID || "");

  await withOwnerClient(async (c) => {
    if (companyId) await c.query("SELECT set_config('app.company_id', $1, true)", [companyId]);
    if (body.action === "checkpoint" && body.screenshot_key) {
      await checkpointBridgeJob(c, id, String(body.screenshot_key));
    } else if (body.action === "fail") {
      await failBridgeJob(c, id, String(body.error || "failed"));
    } else if (body.action === "done") {
      await c.query(
        `UPDATE bridge_jobs SET status = 'done', updated_at = now() WHERE id = $1`,
        [id],
      );
    }
  });
  return NextResponse.json({ ok: true });
}
