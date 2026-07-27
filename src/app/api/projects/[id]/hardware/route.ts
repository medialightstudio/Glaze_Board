// POST advance hardware track (not_started → in_cart → ordered → received / not_needed).

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { maybeFireGate } from "@/lib/status-machine";

const NEXT: Record<string, string> = {
  not_started: "in_cart",
  in_cart: "ordered",
  ordered: "received",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id: projectId } = await params;
  const body = (await req.json()) as Record<string, any>;

  try {
    const result = await withUser(session, async (c) => {
      let orderId = body.order_id as string | undefined;
      if (!orderId) {
        const existing = await c.query(
          `SELECT id FROM hardware_orders WHERE project_id = $1 ORDER BY created_at LIMIT 1`,
          [projectId],
        );
        if (existing.rows[0]) {
          orderId = existing.rows[0].id;
        } else {
          const created = await c.query(
            `INSERT INTO hardware_orders (company_id, project_id, status)
             VALUES ($1, $2, 'not_started') RETURNING id`,
            [session.companyId, projectId],
          );
          orderId = created.rows[0].id;
        }
      }

      const cur = await c.query(
        `SELECT * FROM hardware_orders WHERE id = $1 AND project_id = $2`,
        [orderId, projectId],
      );
      if (!cur.rows[0]) throw new Error("Hardware order not found.");

      const to = body.to || NEXT[cur.rows[0].status];
      if (!to) throw new Error("Can't advance further.");

      const partial = body.partial === true;
      if (partial && to === "received") {
        const { rows } = await c.query(
          `UPDATE hardware_orders SET
             partial = true, missing_note = $1, updated_at = now()
           WHERE id = $2 RETURNING *`,
          [body.missing_note || null, orderId],
        );
        return { order: rows[0] };
      }

      const { rows } = await c.query(
        `UPDATE hardware_orders SET
           status = $1,
           order_number = COALESCE($2, order_number),
           fulfillment = COALESCE($3, fulfillment),
           cost = COALESCE($4, cost),
           partial = CASE WHEN $1 = 'received' THEN false ELSE partial END,
           missing_note = CASE WHEN $1 = 'received' THEN NULL ELSE missing_note END,
           received_at = CASE WHEN $1 = 'received' THEN now() ELSE received_at END,
           updated_at = now()
         WHERE id = $5 RETURNING *`,
        [
          to,
          body.order_number || null,
          body.fulfillment || null,
          body.cost ?? null,
          orderId,
        ],
      );
      await maybeFireGate(c, session, projectId);
      return { order: rows[0] };
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Hardware update failed." },
      { status: 400 },
    );
  }
}
