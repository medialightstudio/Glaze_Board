// GET download — check documents table, then fetch R2 bytes.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { getDocsBucket, objectKey } from "@/lib/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;

  const doc = await withUser(session, async (c) => {
    const { rows } = await c.query(`SELECT * FROM documents WHERE id = $1`, [id]);
    return rows[0] || null;
  });
  if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    const bucket = await getDocsBucket();
    const key = objectKey(session.companyId, doc.id, doc.file);
    const obj = await bucket.get(key);
    if (!obj) return NextResponse.json({ error: "File missing." }, { status: 404 });
    const bytes = await obj.arrayBuffer();
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": doc.mime || obj.httpMetadata?.contentType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${doc.file}"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Download failed." },
      { status: 500 },
    );
  }
}
