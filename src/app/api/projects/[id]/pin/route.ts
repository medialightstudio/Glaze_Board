// POST { lat, lng } — drop a pin by hand when geocoding missed.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as { lat?: number; lng?: number };
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required." }, { status: 400 });
  }
  try {
    await withUser(session, async (c) => {
      await c.query(
        `UPDATE projects SET lat = $1, lng = $2, updated_at = now() WHERE id = $3`,
        [lat, lng, id],
      );
    });
    return NextResponse.json({ ok: true, lat, lng });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not save pin." },
      { status: 400 },
    );
  }
}
