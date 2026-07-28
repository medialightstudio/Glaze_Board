// PATCH project fields used by the hub (access, note).

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  try {
    const row = await withUser(session, async (c) => {
      const sets: string[] = [];
      const vals: unknown[] = [id];
      let i = 2;
      if (body.access_lockbox_code !== undefined) {
        sets.push(`access_lockbox_code = $${i++}`);
        vals.push(String(body.access_lockbox_code || "") || null);
      }
      if (body.access_notes !== undefined) {
        sets.push(`access_notes = $${i++}`);
        vals.push(String(body.access_notes || "") || null);
      }
      if (body.note !== undefined) {
        sets.push(`note = $${i++}`);
        vals.push(String(body.note || "") || null);
      }
      if (sets.length === 0) throw new Error("Nothing to update.");
      sets.push("updated_at = now()");
      const { rows } = await c.query(
        `UPDATE projects SET ${sets.join(", ")} WHERE id = $1
         RETURNING id, access_lockbox_code, access_notes, note`,
        vals,
      );
      if (!rows[0]) throw new Error("Project not found.");
      return rows[0];
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed." },
      { status: 400 },
    );
  }
}
