// Sole writer of project status — transition table + gate (DEC-28).

import type { PoolClient } from "@neondatabase/serverless";
import type { AppSession } from "@/lib/db-core";

export const STATUSES = [
  "lead",
  "measure_scheduled",
  "measured",
  "quote_sent",
  "approved",
  "ordering",
  "ready_to_schedule",
  "install_scheduled",
  "installed",
  "invoiced",
  "paid",
  "on_hold",
  "lost",
] as const;

export type Status = (typeof STATUSES)[number];

export type Actor = { kind: string; userId?: string };

function label(s: string) {
  return s.replace(/_/g, " ");
}

async function feed(
  client: PoolClient,
  companyId: string,
  projectId: string,
  actor: Actor,
  verb: string,
  details: Record<string, unknown>,
) {
  const { rows } = await client.query(
    `INSERT INTO activity_events (company_id, project_id, actor, actor_user_id, verb, details)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING id`,
    [companyId, projectId, actor.kind, actor.userId || null, verb, JSON.stringify(details)],
  );
  return rows[0].id as string;
}

export async function transition(
  client: PoolClient,
  session: AppSession,
  projectId: string,
  to: Status,
  actor: Actor,
  payload: Record<string, unknown> = {},
) {
  const { rows } = await client.query(
    `SELECT id, status, status_timestamps FROM projects WHERE id = $1`,
    [projectId],
  );
  const project = rows[0];
  if (!project) throw new Error("Project not found.");

  const from = project.status as Status;
  if (from === to) return { ok: true as const, from, to, eventId: null as string | null };

  if (to !== "on_hold" && to !== "lost" && from === "lost") {
    throw new Error(`Can't move a lost job to ${label(to)} without reopening.`);
  }
  if (to === "on_hold" || to === "lost") {
    if (!payload.reason || String(payload.reason).trim() === "") {
      throw new Error(`A reason is required to mark ${label(to)}.`);
    }
  }

  const stamps = { ...(project.status_timestamps || {}) } as Record<string, string>;
  stamps[to] = new Date().toISOString();

  await client.query(
    `UPDATE projects SET
       status = $1,
       status_timestamps = $2::jsonb,
       updated_at = now(),
       hold_reason = CASE WHEN $1 = 'on_hold' THEN $3 ELSE hold_reason END,
       hold_until = CASE WHEN $1 = 'on_hold' THEN now() + interval '7 days' ELSE hold_until END,
       lost_reason = CASE WHEN $1 = 'lost' THEN $3 ELSE lost_reason END
     WHERE id = $4`,
    [to, JSON.stringify(stamps), (payload.reason as string) || null, projectId],
  );

  const eventId = await feed(client, session.companyId, projectId, actor, "status_changed", {
    from,
    to,
    ...payload,
  });

  if (["ordering", "ready_to_schedule", "approved"].includes(to) || from === "ordering") {
    await maybeFireGate(client, session, projectId);
  }

  return { ok: true as const, from, to, eventId };
}

export async function undo(
  client: PoolClient,
  session: AppSession,
  eventId: string,
  actor: Actor,
) {
  const { rows } = await client.query(
    `SELECT * FROM activity_events WHERE id = $1 AND verb = 'status_changed'`,
    [eventId],
  );
  const ev = rows[0];
  if (!ev) throw new Error("That feed entry can't be undone.");
  if (ev.undone_by_event_id) throw new Error("Already undone.");

  const from = ev.details?.from as Status;
  const to = ev.details?.to as Status;
  if (!from || !to) throw new Error("Missing status evidence on feed entry.");

  await client.query(`UPDATE projects SET status = $1, updated_at = now() WHERE id = $2`, [
    from,
    ev.project_id,
  ]);
  const undoId = await feed(client, session.companyId, ev.project_id, actor, "status_undone", {
    restores: from,
    undoes: to,
    undoes_event_id: eventId,
  });
  await client.query(`UPDATE activity_events SET undone_by_event_id = $1 WHERE id = $2`, [
    undoId,
    eventId,
  ]);
  return { ok: true as const, status: from };
}

export async function recordApproval(
  client: PoolClient,
  session: AppSession,
  projectId: string,
  actor: Actor,
  payload: { method?: string; note?: string; attachmentDocumentId?: string } = {},
) {
  await client.query(
    `INSERT INTO approvals (company_id, project_id, kind, method, note, attachment_document_id)
     VALUES ($1, $2, 'combined', $3, $4, $5)`,
    [
      session.companyId,
      projectId,
      payload.method || "tap",
      payload.note || null,
      payload.attachmentDocumentId || null,
    ],
  );
  return transition(client, session, projectId, "approved", actor, {
    method: payload.method || "tap",
    note: payload.note,
  });
}

/**
 * DEC-28 — word this exactly:
 * Glass is satisfied when the project has at least one glass order and every one is Received,
 * or the glass track is Not Needed. Hardware is satisfied when it is Received or Not Needed.
 * The gate fires only when both are satisfied and at least one track actually reached Received.
 */
export async function maybeFireGate(
  client: PoolClient,
  session: AppSession,
  projectId: string,
) {
  const glass = await client.query(
    `SELECT id, status FROM glass_orders WHERE project_id = $1`,
    [projectId],
  );
  const hardware = await client.query(
    `SELECT id, status FROM hardware_orders WHERE project_id = $1`,
    [projectId],
  );

  const g = glass.rows as { id: string; status: string }[];
  const h = hardware.rows as { id: string; status: string }[];

  // DEC-28: glass satisfied = (at least one order and every one Received) OR track Not Needed.
  const glassNotNeeded = g.length > 0 && g.every((o) => o.status === "not_needed");
  const glassAllReceived = g.length > 0 && g.every((o) => o.status === "received");
  const glOk = glassAllReceived || glassNotNeeded;

  // Hardware satisfied when Received or Not Needed (track must exist).
  const hwOk =
    h.length > 0 &&
    h.every((o) => o.status === "received" || o.status === "not_needed");

  const anyReceived =
    g.some((o) => o.status === "received") || h.some((o) => o.status === "received");

  if (!(glOk && hwOk && anyReceived)) {
    // Reopen: if gate was fired and a track reopened, clear and drop to ordering
    const proj = await client.query(
      `SELECT status, gate_fired_at FROM projects WHERE id = $1`,
      [projectId],
    );
    if (proj.rows[0]?.gate_fired_at && proj.rows[0].status === "ready_to_schedule") {
      await client.query(
        `UPDATE projects SET gate_fired_at = NULL, status = 'ordering', updated_at = now() WHERE id = $1`,
        [projectId],
      );
      await feed(client, session.companyId, projectId, { kind: "system" }, "gate_cleared", {
        reason: "A supply track reopened.",
      });
    }
    return { fired: false as const };
  }

  const proj = await client.query(
    `SELECT gate_fired_at, status FROM projects WHERE id = $1`,
    [projectId],
  );
  if (proj.rows[0]?.gate_fired_at) return { fired: false as const, already: true };

  await client.query(
    `UPDATE projects SET gate_fired_at = now(), status = 'ready_to_schedule', updated_at = now() WHERE id = $1`,
    [projectId],
  );

  const glassEvidence = g.filter((o) => o.status === "received" || o.status === "not_needed");
  const hwEvidence = h.filter((o) => o.status === "received" || o.status === "not_needed");

  await feed(client, session.companyId, projectId, { kind: "system" }, "gate_fired", {
    glass: glassEvidence.map((o) => o.id),
    hardware: hwEvidence.map((o) => o.id),
  });

  const office = await client.query(
    `SELECT id FROM "user" WHERE company_id = $1 AND role IN ('admin','manager') AND active = true`,
    [session.companyId],
  );
  for (const u of office.rows) {
    await client.query(
      `INSERT INTO notifications (company_id, user_id, title, body, href)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        session.companyId,
        u.id,
        "Ready to schedule",
        "Glass and hardware are satisfied — this job is ready to book.",
        `/m/projects/${projectId}`,
      ],
    );
  }

  return { fired: true as const };
}

export function nextActionFor(status: Status): { label: string; to: Status } | null {
  const map: Partial<Record<Status, { label: string; to: Status }>> = {
    lead: { label: "Book measure", to: "measure_scheduled" },
    measure_scheduled: { label: "Mark measured", to: "measured" },
    measured: { label: "Mark quote sent", to: "quote_sent" },
    quote_sent: { label: "Mark approved", to: "approved" },
    approved: { label: "Start ordering", to: "ordering" },
    ready_to_schedule: { label: "Book install", to: "install_scheduled" },
    install_scheduled: { label: "Mark installed", to: "installed" },
    installed: { label: "Mark invoiced", to: "invoiced" },
    invoiced: { label: "Mark paid", to: "paid" },
  };
  return map[status] || null;
}
