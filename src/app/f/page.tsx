// Field Today — assignees or team members; company-local day (DEC-29).

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSession, isOfficeRole } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { taskColors } from "@/lib/colors";
import { companyTodayExpr } from "@/lib/field-access";

function colorFor(type: string) {
  if (type === "measure") return taskColors.measure;
  if (type === "service") return taskColors.service;
  return taskColors.install;
}

export default async function FieldHome() {
  const session = await getAppSession();
  if (!session) redirect("/login");
  const office = isOfficeRole(session.role);

  const visits = await withUser(session, async (c) => {
    const tz = await companyTodayExpr(c, session.companyId);
    const { rows } = await c.query(
      `SELECT v.id, v.type, v.starts_at::text, v.completed_at::text,
              p.title, p.site_address, p.access_lockbox_code
       FROM visits v
       LEFT JOIN projects p ON p.id = v.project_id
       LEFT JOIN teams t ON t.id = v.team_id
       WHERE (v.starts_at AT TIME ZONE $1)::date
             = (now() AT TIME ZONE $1)::date
         AND (
           $2::boolean = true
           OR $3 = ANY (v.assignees)
           OR (t.id IS NOT NULL AND $3 = ANY (t.member_ids))
         )
       ORDER BY v.starts_at ASC`,
      [tz, office, session.userId],
    );
    return rows as {
      id: string;
      type: string;
      starts_at: string;
      completed_at: string | null;
      title: string;
      site_address: string;
      access_lockbox_code: string | null;
    }[];
  });

  return (
    <main className="p-4 max-w-lg mx-auto space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Field</h1>
        <p className="text-sm text-stone-500">Today&apos;s jobs</p>
      </header>

      {visits.length === 0 ? (
        <p className="text-stone-600 py-8 text-center">No jobs today.</p>
      ) : (
        <ul className="space-y-3">
          {visits.map((v) => {
            const maps = `https://maps.google.com/?q=${encodeURIComponent(v.site_address || "")}`;
            return (
              <li
                key={v.id}
                className="rounded-lg border border-stone-200 bg-white overflow-hidden"
                style={{ borderLeftWidth: 4, borderLeftColor: colorFor(v.type) }}
              >
                <Link href={`/f/jobs/${v.id}`} className="block p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-wide text-stone-500">
                      {v.type}
                      {v.completed_at ? " · done" : ""}
                    </span>
                    <span className="text-xs text-stone-400">
                      {new Date(v.starts_at).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="font-medium mt-1">{v.title || "Job"}</div>
                  <div className="text-sm text-stone-600">{v.site_address}</div>
                </Link>
                <div className="border-t px-3 py-2 flex gap-3 text-sm">
                  <a href={maps} className="text-stone-900 underline" target="_blank" rel="noreferrer">
                    Navigate
                  </a>
                  <Link href={`/f/jobs/${v.id}`} className="text-stone-900 underline">
                    Open
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
