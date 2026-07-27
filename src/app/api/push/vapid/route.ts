// Public VAPID key for the browser push subscription.

import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push";

export async function GET() {
  const key = getVapidPublicKey();
  if (!key) return NextResponse.json({ error: "Push not configured." }, { status: 503 });
  return NextResponse.json({ publicKey: key });
}
