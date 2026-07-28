// Review Queue — Confirm advances; Reassign reverses prior advance.

import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import {
  applyProcurementAdvance,
  reverseProcurementAdvance,
  type MatchCandidate,
} from "@/lib/procure-match";
import { maybeFireGate } from "@/lib/status-machine";
import type { ExtractResult } from "@/lib/ai";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as {
    action?: string;
    project_id?: string | null;
    glass_order_id?: string;
    hardware_order_id?: string;
  };
  const action = String(body.action || "");
  const projectId = body.project_id ? String(body.project_id) : null;

  try {
    await withUser(session, async (c) => {
      const { rows } = await c.query(`SELECT * FROM review_queue_items WHERE id = $1`, [id]);
      const item = rows[0];
      if (!item || item.status !== "open") throw new Error("Item not open.");

      if (action === "ignore") {
        await c.query(
          `UPDATE review_queue_items SET status = 'ignored', resolved_by = $2, resolved_at = now()
           WHERE id = $1`,
          [id, session.userId],
        );
        await c.query(
          `INSERT INTO command_log (company_id, user_id, channel, intent, payload, confirmed)
           VALUES ($1, $2, 'review', 'ignore', $3::jsonb, true)`,
          [session.companyId, session.userId, JSON.stringify({ review_id: id })],
        );
        return;
      }

      if ((action === "confirm" || action === "reassign") && !projectId) {
        throw new Error("Pick a project.");
      }

      const extracted = (item.extract || {}) as ExtractResult;

      if (action === "reassign") {
        // Reverse last procurement_advanced for the previous guessed project
        if (item.guessed_project_id) {
          const prior = await c.query(
            `SELECT details FROM activity_events
             WHERE project_id = $1 AND verb = 'procurement_advanced'
             ORDER BY created_at DESC LIMIT 1`,
            [item.guessed_project_id],
          );
          const details = prior.rows[0]?.details as {
            from?: string;
            glass_order_id?: string;
            hardware_order_id?: string;
          } | null;
          if (details?.from) {
            await reverseProcurementAdvance(c, session.companyId, {
              project_id: item.guessed_project_id,
              from: details.from,
              glass_order_id: details.glass_order_id,
              hardware_order_id: details.hardware_order_id,
            });
          }
        }
        if (item.document_id) {
          await c.query(`UPDATE documents SET project_id = $2 WHERE id = $1`, [
            item.document_id,
            projectId,
          ]);
        }
        await c.query(
          `UPDATE review_queue_items
           SET status = 'reassigned', guessed_project_id = $2, resolved_by = $3, resolved_at = now()
           WHERE id = $1`,
          [id, projectId, session.userId],
        );
        await c.query(
          `INSERT INTO command_log (company_id, user_id, channel, intent, payload, confirmed)
           VALUES ($1, $2, 'review', 'reassign', $3::jsonb, true)`,
          [
            session.companyId,
            session.userId,
          JSON.stringify({ review_id: id, project_id: projectId }),
        ],
        );
        return;
      }

      // confirm
      if (item.document_id && projectId) {
        await c.query(`UPDATE documents SET project_id = $2 WHERE id = $1`, [
          item.document_id,
          projectId,
        ]);
      }
      const match: MatchCandidate = {
        project_id: projectId!,
        glass_order_id: body.glass_order_id,
        hardware_order_id: body.hardware_order_id,
        label: "manual confirm",
        score: 1,
        via: "review",
      };
      // Prefer glass order on project if not provided
      if (!match.glass_order_id) {
        const g = await c.query(
          `SELECT id FROM glass_orders WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [projectId],
        );
        match.glass_order_id = g.rows[0]?.id;
      }
      const adv = await applyProcurementAdvance(
        c,
        session.companyId,
        extracted,
        match,
        item.document_id,
      );
      if (adv.advanced) {
        await maybeFireGate(c, session, projectId!);
      }
      await c.query(
        `UPDATE review_queue_items
         SET status = 'confirmed', guessed_project_id = $2, resolved_by = $3, resolved_at = now(),
             alternatives = $4::jsonb
         WHERE id = $1`,
        [
          id,
          projectId,
          session.userId,
          JSON.stringify([
            {
              ...match,
              advanced_from: adv.from,
            },
          ]),
        ],
      );
      await c.query(
        `INSERT INTO activity_events (company_id, project_id, actor, actor_user_id, verb, details)
         VALUES ($1, $2, 'office', $3, 'review_resolved', $4::jsonb)`,
        [
          session.companyId,
          projectId,
          session.userId,
          JSON.stringify({ review_id: id, action: "confirm", advanced: adv.advanced }),
        ],
      );
      await c.query(
        `INSERT INTO command_log (company_id, user_id, channel, intent, payload, confirmed)
         VALUES ($1, $2, 'review', 'confirm', $3::jsonb, true)`,
        [
          session.companyId,
          session.userId,
          JSON.stringify({ review_id: id, project_id: projectId }),
        ],
      );
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed." },
      { status: 400 },
    );
  }
}
