// Pipeline — five lanes (DEC-32), not eleven columns.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { Badge } from "@/components/ui/badge";

const LANES: { title: string; statuses: string[] }[] = [
  {
    title: "Sales",
    statuses: ["lead", "measure_scheduled", "measured", "quote_sent"],
  },
  { title: "Ordering", statuses: ["approved", "ordering"] },
  {
    title: "Ready & Scheduled",
    statuses: ["ready_to_schedule", "install_scheduled"],
  },
  { title: "Installed", statuses: ["installed"] },
  { title: "Billing", statuses: ["invoiced", "paid"] },
];

function daysInStatus(timestamps: Record<string, string> | null, status: string) {
  const at = timestamps?.[status];
  if (!at) return 0;
  return Math.floor((Date.now() - new Date(at).getTime()) / (24 * 60 * 60 * 1000));
}

export default async function PipelinePage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  const projects = await withUser(session, async (c) => {
    const { rows } = await c.query(
      `SELECT p.id, p.title, p.status, p.status_timestamps, p.updated_at, a.name AS account_name,
         (SELECT g.status FROM glass_orders g WHERE g.project_id = p.id ORDER BY g.created_at LIMIT 1) AS glass_status,
         (SELECT h.status FROM hardware_orders h WHERE h.project_id = p.id ORDER BY h.created_at LIMIT 1) AS hardware_status
       FROM projects p
       JOIN accounts a ON a.id = p.account_id
       WHERE p.status NOT IN ('on_hold', 'lost')
       ORDER BY p.updated_at DESC`,
    );
    return rows;
  });

  const held = await withUser(session, async (c) => {
    const { rows } = await c.query(
      `SELECT id, title, status FROM projects WHERE status IN ('on_hold','lost') LIMIT 20`,
    );
    return rows;
  });

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Pipeline</h1>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {LANES.map((lane) => {
          const cards = projects.filter((p: { status: string }) =>
            lane.statuses.includes(p.status),
          );
          return (
            <section
              key={lane.title}
              className="min-w-[220px] w-[220px] shrink-0 rounded-lg bg-stone-50 border p-2"
            >
              <h2 className="text-xs font-medium uppercase text-stone-500 px-1 mb-2">
                {lane.title}
                <span className="ml-1 text-stone-400">{cards.length}</span>
              </h2>
              <div className="space-y-2">
                {cards.map(
                  (p: {
                    id: string;
                    title: string;
                    status: string;
                    account_name: string;
                    status_timestamps: Record<string, string>;
                    glass_status?: string;
                    hardware_status?: string;
                  }) => {
                    const days = daysInStatus(p.status_timestamps, p.status);
                    return (
                      <Link
                        key={p.id}
                        href={`/m/projects/${p.id}`}
                        className="block rounded border bg-white px-2 py-2 hover:bg-stone-50"
                      >
                        <div className="text-sm font-medium leading-snug">{p.title}</div>
                        <div className="text-xs text-stone-500">{p.account_name}</div>
                        <div className="mt-1 flex flex-wrap gap-1 items-center">
                          <Badge variant="secondary" className="text-[10px]">
                            {p.status.replace(/_/g, " ")}
                          </Badge>
                          <span className={days > 7 ? "text-xs text-amber-600" : "text-xs text-stone-400"}>
                            {days}d
                          </span>
                        </div>
                        <div className="mt-1 flex gap-1 text-[10px] text-stone-500">
                          {p.glass_status ? <span>G:{p.glass_status}</span> : null}
                          {p.hardware_status ? <span>H:{p.hardware_status}</span> : null}
                        </div>
                      </Link>
                    );
                  },
                )}
                {cards.length === 0 ? (
                  <p className="text-xs text-stone-400 px-1">Empty</p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
      {held.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-stone-500">
            On hold / Lost ({held.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {held.map((p: { id: string; title: string; status: string }) => (
              <li key={p.id}>
                <Link href={`/m/projects/${p.id}`} className="underline">
                  {p.title}
                </Link>{" "}
                <span className="text-stone-400">{p.status}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
