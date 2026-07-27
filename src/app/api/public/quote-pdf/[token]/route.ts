// Public PDF download for shared quotes.

import { NextResponse } from "next/server";
import { systemContext, withOwnerClient } from "@/lib/db-core";
import { getDocsBucket, objectKey } from "@/lib/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const found = await withOwnerClient(async (c) => {
    const { rows } = await c.query(
      `SELECT id, company_id, pdf_document_id FROM quotes WHERE share_token = $1`,
      [token],
    );
    return rows[0] as
      | { id: string; company_id: string; pdf_document_id: string | null }
      | undefined;
  });
  if (!found?.pdf_document_id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const doc = await systemContext(found.company_id, async (c) => {
    const { rows } = await c.query(`SELECT * FROM documents WHERE id = $1`, [
      found.pdf_document_id,
    ]);
    return rows[0];
  });
  if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const bucket = await getDocsBucket();
  const obj = await bucket.get(objectKey(found.company_id, doc.id, doc.file));
  if (!obj) return NextResponse.json({ error: "Missing file." }, { status: 404 });
  const bytes = await obj.arrayBuffer();
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.file}"`,
    },
  });
}
