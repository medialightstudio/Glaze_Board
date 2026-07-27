// POST multipart upload — documents table first, then R2 bytes.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { getDocsBucket, objectKey } from "@/lib/storage";

function typeFromName(name: string) {
  const lower = name.toLowerCase();
  if (/\.(png|jpe?g|gif|webp)$/.test(lower)) return "photo";
  if (/\.pdf$/.test(lower)) return "other";
  return "other";
}

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const projectId = String(form.get("project_id") || "");
  if (!(file instanceof File) || !projectId) {
    return NextResponse.json({ error: "file and project_id are required." }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  const size = file.size;
  const fileName = file.name || "upload";
  const docType = String(form.get("type") || typeFromName(fileName));

  try {
    const doc = await withUser(session, async (c) => {
      const proj = await c.query(`SELECT id FROM projects WHERE id = $1`, [projectId]);
      if (!proj.rows[0]) throw new Error("Project not found.");
      const { rows } = await c.query(
        `INSERT INTO documents (company_id, file, type, mime, size, project_id, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'upload') RETURNING *`,
        [session.companyId, fileName, docType, mime, size, projectId],
      );
      return rows[0];
    });

    const bucket = await getDocsBucket();
    const key = objectKey(session.companyId, doc.id, fileName);
    const buf = new Uint8Array(await file.arrayBuffer());
    await bucket.put(key, buf, { httpMetadata: { contentType: mime } });

    return NextResponse.json(doc, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed." },
      { status: 400 },
    );
  }
}
