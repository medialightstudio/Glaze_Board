// Today — urgent → visits → Ready → will-call → Review → exceptions.

import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { redirect } from "next/navigation";
import { DraftList } from "@/components/draft-list";
import { OpsPage, OpsSection, OpsEmpty } from "@/components/ops/ops-page";
import { ActionCard } from "@/components/ops/action-card";
import { taskColors } from "@/lib/colors";

export default async function TodayPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  let ready: { id: string; title: string; site_address?: string }[] = [];
  let willCall: {
    id: string;
    project_id: string;
    title: string;
    order_number: string;
    site_address?: string;
  }[] = [];
  let visits: {
    id: string;
    type: string;
    starts_at: string;
    title: string;
    address?: string;
    project_id?: string;
    ticket_id?: string;
  }[] = [];
  let urgent: { id: string; issue: string; address?: string }[] = [];
  let exceptions: { id: string; summary: string; project_id: string | null }[] =
    [];
  let reviewCount = 0;
  let drafts: {
    id: string;
    kind: string;
    body: string;
    project_id: string | null;
  }[] = [];

  try {
    await withUser(session, async (client) => {
      try {
        const r = await client.query(
          `SELECT id, title, site_address FROM projects
           WHERE status = 'ready_to_schedule' ORDER BY updated_at DESC LIMIT 20`,
        );
        ready = r.rows;
      } catch {
        /* table may not exist yet */
      }
      try {
        const w = await client.query(
          `SELECT h.id, h.project_id, h.order_number, p.title, p.site_address
           FROM hardware_orders h
           JOIN projects p ON p.id = h.project_id
           WHERE h.fulfillment = 'will_call' AND h.status = 'ordered'
           ORDER BY h.updated_at DESC LIMIT 20`,
        );
        willCall = w.rows;
      } catch {
        /* later */
      }
      try {
        const v = await client.query(
          `SELECT v.id, v.type, v.starts_at::text, v.project_id, v.ticket_id,
                  coalesce(p.title, t.issue, 'Visit') AS title,
                  coalesce(p.site_address, t.address) AS address
           FROM visits v
           LEFT JOIN projects p ON p.id = v.project_id
           LEFT JOIN tickets t ON t.id = v.ticket_id
           WHERE v.starts_at::date = (now() AT TIME ZONE coalesce(
             (SELECT timezone FROM companies WHERE id = $1), 'America/Los_Angeles'
           ))::date
           ORDER BY v.starts_at`,
          [session.companyId],
        );
        visits = v.rows;
      } catch {
        /* later */
      }
      try {
        const u = await client.query(
          `SELECT id, issue, address FROM tickets
           WHERE urgency = 'urgent' AND status = 'new'
           ORDER BY created_at DESC LIMIT 20`,
        );
        urgent = u.rows;
      } catch {
        /* later */
      }
      try {
        const ex = await client.query(
          `SELECT id, summary, project_id FROM exceptions
           WHERE resolved = false ORDER BY created_at DESC LIMIT 20`,
        );
        exceptions = ex.rows;
      } catch {
        /* automation */
      }
      try {
        const rq = await client.query(
          `SELECT count(*)::int AS n FROM review_queue_items WHERE status = 'open'`,
        );
        reviewCount = rq.rows[0]?.n || 0;
      } catch {
        /* automation */
      }
      try {
        const d = await client.query(
          `SELECT id, kind, body, project_id FROM message_drafts
           WHERE status = 'draft' ORDER BY created_at DESC LIMIT 10`,
        );
        drafts = d.rows;
      } catch {
        /* automation */
      }
    });
  } catch {
    /* db blank */
  }

  const empty =
    urgent.length +
      visits.length +
      ready.length +
      willCall.length +
      exceptions.length +
      reviewCount ===
    0;

  return (
    <OpsPage title="Today" purpose="What needs you before anything else.">
      {empty ? <p className="text-stone-600">Nothing needs you. Enjoy it.</p> : null}

      <OpsSection title="Urgent tickets" count={urgent.length || undefined}>
        {urgent.length === 0 ? (
          <OpsEmpty>None</OpsEmpty>
        ) : (
          urgent.map((t) => (
            <ActionCard
              key={t.id}
              href={`/m/service/${t.id}`}
              label={t.issue}
              meta={t.address || undefined}
              action="Open"
              stripe="urgent"
              urgent
            />
          ))
        )}
      </OpsSection>

      <OpsSection title="Today's visits" count={visits.length || undefined}>
        {visits.length === 0 ? (
          <OpsEmpty>None</OpsEmpty>
        ) : (
          visits.map((v) => {
            const href = v.project_id
              ? `/m/projects/${v.project_id}`
              : v.ticket_id
                ? `/m/service/${v.ticket_id}`
                : `/f/jobs/${v.id}`;
            const stripe =
              v.type === "measure"
                ? taskColors.measure
                : v.type === "install"
                  ? taskColors.install
                  : taskColors.service;
            const time = new Date(v.starts_at).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            });
            return (
              <ActionCard
                key={v.id}
                href={href}
                label={`${v.type} · ${v.title}`}
                meta={[time, v.address].filter(Boolean).join(" · ")}
                action="Open"
                stripe={stripe}
              />
            );
          })
        )}
      </OpsSection>

      <OpsSection title="Ready to Schedule" count={ready.length || undefined}>
        {ready.length === 0 ? (
          <OpsEmpty>No jobs waiting</OpsEmpty>
        ) : (
          ready.map((p) => (
            <ActionCard
              key={p.id}
              href={`/m/projects/${p.id}`}
              label={p.title}
              meta={p.site_address}
              action="Book install"
              stripe="install"
            />
          ))
        )}
      </OpsSection>

      <OpsSection title="Will-call ready" count={willCall.length || undefined}>
        {willCall.length === 0 ? (
          <OpsEmpty>None</OpsEmpty>
        ) : (
          willCall.map((w) => (
            <ActionCard
              key={w.id}
              href={`/m/projects/${w.project_id}`}
              label={`${w.title} · ${w.order_number || "CRL"}`}
              meta={w.site_address}
              action="Pickup"
            />
          ))
        )}
      </OpsSection>

      <OpsSection title="Review Queue">
        {reviewCount === 0 ? (
          <OpsEmpty>Clear</OpsEmpty>
        ) : (
          <ActionCard
            href="/m/review"
            label={`${reviewCount} item${reviewCount === 1 ? "" : "s"} need a look`}
            action="Review"
          />
        )}
      </OpsSection>

      <OpsSection title="Exceptions" count={exceptions.length || undefined}>
        {exceptions.length === 0 ? (
          <OpsEmpty>None</OpsEmpty>
        ) : (
          exceptions.map((e) => (
            <ActionCard
              key={e.id}
              href={e.project_id ? `/m/projects/${e.project_id}` : "/m"}
              label={e.summary}
              action="Open"
            />
          ))
        )}
      </OpsSection>

      <DraftList drafts={drafts} />
    </OpsPage>
  );
}
