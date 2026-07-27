// Dispatch — week visit list + map; rows open the project (or ticket).

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { taskColors } from "@/lib/colors";
import type { MapPin } from "@/lib/maps";
import { MapView } from "@/components/map-view";
import { BookVisitForm } from "./book-visit";
import { OpsPage } from "@/components/ops/ops-page";

export default async function DispatchPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  const visits = await withUser(session, async (c) => {
    const { rows } = await c.query(
      `SELECT v.id, v.type, v.starts_at::text, v.assignees, v.duration::text,
              coalesce(p.title, t.issue, 'Visit') AS title,
              coalesce(p.site_address, t.address) AS address,
              p.lat, p.lng, t.urgency,
              v.project_id, v.ticket_id
       FROM visits v
       LEFT JOIN projects p ON p.id = v.project_id
       LEFT JOIN tickets t ON t.id = v.ticket_id
       WHERE v.starts_at >= date_trunc('week', now())
         AND v.starts_at < date_trunc('week', now()) + interval '7 days'
       ORDER BY v.starts_at`,
    );
    return rows;
  });

  const users = await withUser(session, async (c) => {
    const { rows } = await c.query(
      `SELECT id, name FROM "user" WHERE company_id = $1 AND active = true ORDER BY name`,
      [session.companyId],
    );
    return rows;
  });

  const projects = await withUser(session, async (c) => {
    const { rows } = await c.query(
      `SELECT id, title FROM projects
       WHERE status IN ('lead','measure_scheduled','ready_to_schedule','install_scheduled')
       ORDER BY updated_at DESC LIMIT 40`,
    );
    return rows;
  });

  const pins: MapPin[] = visits
    .filter((v: { lat?: number; lng?: number }) => v.lat != null && v.lng != null)
    .map(
      (v: {
        id: string;
        type: string;
        title: string;
        lat: number;
        lng: number;
        urgency?: string;
        project_id?: string;
        ticket_id?: string;
      }) => ({
        id: v.id,
        lat: Number(v.lat),
        lng: Number(v.lng),
        color:
          v.type === "measure"
            ? taskColors.measure
            : v.type === "install"
              ? taskColors.install
              : taskColors.service,
        urgent: v.urgency === "urgent",
        label: v.title,
        href: v.project_id
          ? `/m/projects/${v.project_id}`
          : v.ticket_id
            ? `/m/service/${v.ticket_id}`
            : `/f/jobs/${v.id}`,
      }),
    );

  return (
    <OpsPage
      title="Dispatch"
      purpose="This week's visits — open a row for the job hub."
      wide
      actions={<BookVisitForm users={users} projects={projects} />}
    >
      <MapView pins={pins} />

      {visits.length === 0 ? (
        <p className="text-sm text-stone-500">No visits this week.</p>
      ) : (
        <ul className="space-y-2">
          {visits.map(
            (v: {
              id: string;
              type: string;
              starts_at: string;
              title: string;
              address?: string;
              project_id?: string;
              ticket_id?: string;
              assignees: string[];
            }) => {
              const color =
                v.type === "measure"
                  ? taskColors.measure
                  : v.type === "install"
                    ? taskColors.install
                    : taskColors.service;
              const href = v.project_id
                ? `/m/projects/${v.project_id}`
                : v.ticket_id
                  ? `/m/service/${v.ticket_id}`
                  : `/f/jobs/${v.id}`;
              return (
                <li
                  key={v.id}
                  className="rounded border px-3 py-2 text-sm flex gap-3"
                >
                  <span
                    className="w-1.5 rounded shrink-0"
                    style={{ background: color }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <Link
                        href={href}
                        className="font-medium hover:underline truncate"
                      >
                        {v.title}
                      </Link>
                      <span className="text-stone-500 shrink-0">
                        {new Date(v.starts_at).toLocaleString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="text-stone-600 capitalize flex gap-2">
                      <span>{v.type}</span>
                      {v.project_id ? (
                        <Link
                          href={`/f/jobs/${v.id}`}
                          className="text-xs underline text-stone-500"
                        >
                          Field view
                        </Link>
                      ) : null}
                    </div>
                    {v.address ? (
                      <a
                        className="text-xs text-stone-500 underline"
                        href={`https://maps.google.com/?q=${encodeURIComponent(v.address)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {v.address}
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            },
          )}
        </ul>
      )}
    </OpsPage>
  );
}
