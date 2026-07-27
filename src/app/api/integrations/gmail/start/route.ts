import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { gmailAuthUrl, gmailConfigured } from "@/lib/gmail";

export async function GET(req: Request) {
  const session = await getAppSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }
  if (!gmailConfigured()) {
    return NextResponse.json(
      { error: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." },
      { status: 400 },
    );
  }
  const url = new URL(req.url);
  const purpose = url.searchParams.get("purpose") === "service" ? "service" : "office";
  const redirectUri = `${process.env.BETTER_AUTH_URL}/api/integrations/gmail/callback`;
  const state = Buffer.from(
    JSON.stringify({ companyId: session.companyId, purpose, userId: session.userId }),
  ).toString("base64url");
  return NextResponse.redirect(gmailAuthUrl(state, redirectUri));
}
