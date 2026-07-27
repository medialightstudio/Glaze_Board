// Service board — New / Scheduled / Resolved + new ticket.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { Badge } from "@/components/ui/badge";
import { NewTicketDialog } from "./new-ticket";
import { taskColors } from "@/lib/colors";
import { OpsPage } from "@/components/ops/ops-page";

const COLS = [
  { title: "New", statuses: ["new"] },
  { title: "Scheduled", statuses: ["scheduled"] },
  { title: "Resolved", statuses: ["resolved", "closed"] },
];

export default async function ServiceBoardPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  const tickets = await withUser(session, async (c) => {
    const { rows } = await c.query(
      `SELECT t.id, t.status, t.contact_name, t.address, t.issue, t.urgency, t.classification,
              t.no_match, t.project_id, t.created_at, p.title AS project_title
       FROM tickets t
       LEFT JOIN projects p ON p.id = t.project_id
       ORDER BY
         CASE t.urgency WHEN 'urgent' THEN 0 ELSE 1 END,
         t.created_at DESC
       LIMIT 100`,
    );
    return rows;
  });

  return (
    <OpsPage
      title="Service"
      purpose="Urgent tickets → schedule a visit → resolve."
      wide
      actions={<NewTicketDialog />}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLS.map((col) => {
          const cards = tickets.filter((t: { status: string }) =>
            col.statuses.includes(t.status),
          );
          return (
            <section
              key={col.title}
              className="min-w-[240px] w-[240px] shrink-0 rounded-lg border bg-stone-50 p-2"
            >
              <h2 className="text-xs font-medium uppercase text-stone-500 px-1 mb-2">
                {col.title} ({cards.length})
              </h2>
              <div className="space-y-2">
                {cards.map(
                  (t: {
                    id: string;
                    contact_name?: string;
                    address?: string;
                    issue: string;
                    urgency: string;
                    classification?: string;
                    no_match: boolean;
                    project_id?: string;
                    project_title?: string;
                  }) => (
                    <Link
                      key={t.id}
                      href={`/m/service/${t.id}`}
                      className="block rounded border bg-white px-2 py-2 hover:bg-stone-50"
                      style={
                        t.urgency === "urgent"
                          ? { boxShadow: `0 0 0 2px ${taskColors.urgentRing}` }
                          : undefined
                      }
                    >
                      <div className="text-sm font-medium">
                        {t.contact_name || t.address || "Ticket"}
                      </div>
                      <div className="text-xs text-stone-600 line-clamp-2">
                        {t.issue}
                      </div>
                      {t.project_title ? (
                        <div className="text-[10px] text-stone-500 mt-1 truncate">
                          → {t.project_title}
                        </div>
                      ) : null}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {t.classification ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {t.classification}
                          </Badge>
                        ) : null}
                        {t.no_match ? (
                          <Badge variant="outline" className="text-[10px]">
                            no match
                          </Badge>
                        ) : null}
                      </div>
                    </Link>
                  ),
                )}
              </div>
            </section>
          );
        })}
      </div>
    </OpsPage>
  );
}
