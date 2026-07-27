// Today view — urgent → visits → Ready → will-call → exceptions.

import Link from "next/link";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { redirect } from "next/navigation";

export default async function TodayPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  let ready: { id: string; title: string }[] = [];
  let willCall: { id: string; title: string; order_number: string }[] = [];
  let visits: { id: string; type: string; starts_at: string; title: string }[] = [];
  let urgent: { id: string; issue: string }[] = [];
  let exceptions: { id: string; summary: string; project_id: string | null }[] = [];
  let reviewCount = 0;

  try {
    await withUser(session, async (client) => {
      try {
        const r = await client.query(
          `SELECT id, title FROM projects WHERE status = 'ready_to_schedule' ORDER BY updated_at DESC LIMIT 20`,
        );
        ready = r.rows;
      } catch {
        /* table may not exist yet */
      }
      try {
        const w = await client.query(
          `SELECT h.id, h.order_number, p.title
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
          `SELECT v.id, v.type, v.starts_at::text, coalesce(p.title, t.issue, 'Visit') AS title
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
          `SELECT id, issue FROM tickets WHERE urgency = 'urgent' AND status = 'new' ORDER BY created_at DESC LIMIT 20`,
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
    <div className="p-4 space-y-6 max-w-3xl">
      <h1 className="text-xl font-semibold">Today</h1>
      {empty ? (
        <p className="text-stone-600">Nothing needs you. Enjoy it.</p>
      ) : null}

      <Section title="Urgent tickets">
        {urgent.length === 0 ? (
          <Placeholder note="Arrives with Service (Phase F)" />
        ) : (
          urgent.map((t) => (
            <CardLink key={t.id} href={`/m/service/${t.id}`} label={t.issue} action="Open" />
          ))
        )}
      </Section>

      <Section title="Today's visits">
        {visits.length === 0 ? (
          <Placeholder note="Arrives with Dispatch (Phase F)" />
        ) : (
          visits.map((v) => (
            <CardLink
              key={v.id}
              href="/m/dispatch"
              label={`${v.type} · ${v.title}`}
              action="Open"
            />
          ))
        )}
      </Section>

      <Section title="Ready to Schedule">
        {ready.length === 0 ? (
          <Placeholder note="No jobs waiting" />
        ) : (
          ready.map((p) => (
            <CardLink key={p.id} href={`/m/projects/${p.id}`} label={p.title} action="Schedule" />
          ))
        )}
      </Section>

      <Section title="Will-call ready">
        {willCall.length === 0 ? (
          <Placeholder note="None" />
        ) : (
          willCall.map((w) => (
            <CardLink
              key={w.id}
              href={`/m/projects/${w.id}`}
              label={`${w.title} · ${w.order_number}`}
              action="Pickup"
            />
          ))
        )}
      </Section>

      <Section title="Review Queue">
        {reviewCount === 0 ? (
          <Placeholder note="Clear" />
        ) : (
          <CardLink href="/m/review" label={`${reviewCount} items need a look`} action="Review" />
        )}
      </Section>

      <Section title="Exceptions">
        {exceptions.length === 0 ? (
          <Placeholder note="None" />
        ) : (
          exceptions.map((e) => (
            <CardLink
              key={e.id}
              href={e.project_id ? `/m/projects/${e.project_id}` : "/m"}
              label={e.summary}
              action="Open"
            />
          ))
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-medium uppercase text-stone-500 mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Placeholder({ note }: { note: string }) {
  return <p className="text-sm text-stone-500">{note}</p>;
}

function CardLink({
  href,
  label,
  action,
}: {
  href: string;
  label: string;
  action: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded border px-3 py-2 hover:bg-stone-50"
    >
      <span className="text-sm">{label}</span>
      <span className="text-xs font-medium text-stone-600">{action}</span>
    </Link>
  );
}
