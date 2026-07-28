// Pipeline — five lanes (DEC-32), not eleven columns.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { Badge } from "@/components/ui/badge";
import { OpsPage } from "@/components/ops/ops-page";
import { taskColors } from "@/lib/colors";

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

function TrackChip({
  letter,
  status,
}: {
  letter: string;
  status?: string | null;
}) {
  if (!status) return null;
  const done = status === "received" || status === "not_needed";
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] border"
      style={{
        borderColor: done ? taskColors.install : "#d6d3d1",
        color: done ? taskColors.install : "#57534e",
      }}
      title={`${letter}: ${status}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: done ? taskColors.install : "#a8a29e" }}
      />
      {letter}:{status === "not_needed" ? "n/a" : status.replace(/_/g, " ")}
    </span>
  );
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
    <OpsPage
      title="Pipeline"
      purpose="Jobs by stage — open any card for the full hub."
      wide
      className="max-w-none"
    >
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
                    const stripe =
                      p.status === "measure_scheduled" || p.status === "measured"
                        ? taskColors.measure
                        : p.status === "ready_to_schedule" ||
                            p.status === "install_scheduled"
                          ? taskColors.install
                          : undefined;
                    return (
                      <Link
                        key={p.id}
                        href={`/m/projects/${p.id}`}
                        className="flex rounded border bg-white hover:bg-stone-50 overflow-hidden"
                      >
                        {stripe ? (
                          <span
                            className="w-1.5 shrink-0"
                            style={{ background: stripe }}
                            aria-hidden
                          />
                        ) : null}
                        <div className="px-2 py-2 min-w-0 flex-1">
                          <div className="text-sm font-medium leading-snug">
                            {p.title}
                          </div>
                          <div className="text-xs text-stone-500">
                            {p.account_name}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1 items-center">
                            <Badge variant="secondary" className="text-[10px]">
                              {p.status.replace(/_/g, " ")}
                            </Badge>
                            <span
                              className={
                                days > 7
                                  ? "text-xs text-amber-600"
                                  : "text-xs text-stone-400"
                              }
                            >
                              {days}d
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <TrackChip letter="G" status={p.glass_status} />
                            <TrackChip letter="H" status={p.hardware_status} />
                          </div>
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
    </OpsPage>
  );
}
