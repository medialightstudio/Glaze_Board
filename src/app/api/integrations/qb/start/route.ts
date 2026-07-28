import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { qbAuthUrl, qbConfigured } from "@/lib/quickbooks";

export async function GET() {
  const session = await getAppSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }
  if (!qbConfigured()) {
    return NextResponse.json({ error: "Set QB_CLIENT_ID and QB_CLIENT_SECRET." }, { status: 400 });
  }
  const redirectUri = `${process.env.BETTER_AUTH_URL}/api/integrations/qb/callback`;
  const state = Buffer.from(JSON.stringify({ companyId: session.companyId })).toString(
    "base64url",
  );
  return NextResponse.redirect(qbAuthUrl(state, redirectUri));
}
