// POST quick-create project {account_id, site_address, note?, job_type?, account_name?, zip?}.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { createProject, getAccount } from "@/lib/db";
import { geocode } from "@/lib/maps";

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await req.json()) as Record<string, any>;
  const accountId = String(body.account_id || "").trim();
  const site = String(body.site_address || "").trim();
  if (!accountId || !site) {
    return NextResponse.json(
      { error: "Customer and site address are required." },
      { status: 400 },
    );
  }

  try {
    const project = await withUser(session, async (c) => {
      const account = await getAccount(c, accountId);
      if (!account) throw new Error("Customer not found.");
      return createProject(c, session.companyId, {
        account_id: accountId,
        site_address: site,
        note: body.note,
        job_type: body.job_type,
        account_name: body.account_name || account.name,
        zip: body.zip,
      });
    });

    // Geocode after save — never block create if Nominatim fails (new construction).
    try {
      const point = await geocode(site);
      if (point) {
        await withUser(session, async (c) => {
          await c.query(
            `UPDATE projects SET lat = $1, lng = $2, updated_at = now() WHERE id = $3`,
            [point.lat, point.lng, project.id],
          );
        });
        project.lat = point.lat;
        project.lng = point.lng;
      }
    } catch {
      /* leave lat/lng null — owner can drop a pin */
    }

    return NextResponse.json(project, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create project." },
      { status: 400 },
    );
  }
}
