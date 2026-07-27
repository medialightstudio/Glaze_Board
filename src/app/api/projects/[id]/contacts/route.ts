// POST link (or create+link) a contact onto a project with a role.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { createContact } from "@/lib/db";

const ROLES = ["homeowner", "contractor", "pm", "other"] as const;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id: projectId } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const name = String(body.name || "").trim();
  const role = String(body.role || "other");
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!ROLES.includes(role as (typeof ROLES)[number])) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  try {
    const row = await withUser(session, async (c) => {
      const proj = await c.query(
        `SELECT id, account_id FROM projects WHERE id = $1`,
        [projectId],
      );
      if (!proj.rows[0]) throw new Error("Project not found.");

      let contactId = body.contact_id ? String(body.contact_id) : "";
      if (!contactId) {
        const contact = await createContact(c, session.companyId, {
          account_id: proj.rows[0].account_id,
          name,
          phone: body.phone ? String(body.phone) : undefined,
          email: body.email ? String(body.email) : undefined,
        });
        contactId = contact.id;
      }

      const existing = await c.query(
        `SELECT * FROM project_contacts WHERE project_id = $1 AND contact_id = $2`,
        [projectId, contactId],
      );
      if (existing.rows[0]) {
        const { rows } = await c.query(
          `UPDATE project_contacts SET role = $2, updated_at = now()
           WHERE id = $1 RETURNING *`,
          [existing.rows[0].id, role],
        );
        return rows[0];
      }
      const { rows } = await c.query(
        `INSERT INTO project_contacts (company_id, project_id, contact_id, role, is_primary)
         VALUES ($1, $2, $3, $4, COALESCE($5, false))
         RETURNING *`,
        [
          session.companyId,
          projectId,
          contactId,
          role,
          body.is_primary === true,
        ],
      );
      return rows[0];
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not add contact." },
      { status: 400 },
    );
  }
}
