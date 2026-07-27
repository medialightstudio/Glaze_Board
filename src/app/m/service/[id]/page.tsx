// Ticket detail — link to project + book service visit into Dispatch/Field.

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { Badge } from "@/components/ui/badge";
import { OpsPage } from "@/components/ops/ops-page";
import { BookServiceVisit } from "../book-service";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAppSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const data = await withUser(session, async (c) => {
    const { rows } = await c.query(`SELECT * FROM tickets WHERE id = $1`, [id]);
    const ticket = rows[0] || null;
    if (!ticket) return null;
    let project = null;
    if (ticket.project_id) {
      const p = await c.query(
        `SELECT id, title, status FROM projects WHERE id = $1`,
        [ticket.project_id],
      );
      project = p.rows[0] || null;
    }
    const users = await c.query(
      `SELECT id, name FROM "user" WHERE company_id = $1 AND active = true ORDER BY name`,
      [session.companyId],
    );
    const visits = await c.query(
      `SELECT id, starts_at::text, type FROM visits
       WHERE ticket_id = $1 ORDER BY starts_at DESC LIMIT 5`,
      [id],
    );
    return { ticket, project, users: users.rows, visits: visits.rows };
  });
  if (!data) notFound();

  const { ticket, project, users, visits } = data;
  const mapUrl = ticket.address
    ? `https://maps.google.com/?q=${encodeURIComponent(ticket.address)}`
    : null;

  return (
    <OpsPage
      title={ticket.contact_name || ticket.address || "Ticket"}
      purpose="Schedule into Dispatch — same visit system as measures."
      actions={
        <BookServiceVisit
          ticketId={id}
          projectId={ticket.project_id || undefined}
          users={users}
        />
      }
    >
      <p>
        <Link href="/m/service" className="text-sm text-stone-500 hover:underline">
          ← Service
        </Link>
      </p>
      <div className="flex flex-wrap gap-2">
        <Badge>{ticket.status}</Badge>
        <Badge variant={ticket.urgency === "urgent" ? "destructive" : "secondary"}>
          {ticket.urgency}
        </Badge>
        {ticket.classification ? (
          <Badge variant="outline">{ticket.classification}</Badge>
        ) : null}
        {ticket.no_match ? (
          <Badge variant="outline">no matching project</Badge>
        ) : null}
      </div>

      <section className="space-y-1 text-sm">
        {ticket.contact_phone ? (
          <p>
            <a href={`tel:${ticket.contact_phone}`} className="underline">
              {ticket.contact_phone}
            </a>
            {" · "}
            <a href={`sms:${ticket.contact_phone}`} className="underline">
              Text
            </a>
          </p>
        ) : null}
        {ticket.contact_email ? (
          <p className="text-stone-600">{ticket.contact_email}</p>
        ) : null}
        {ticket.address ? (
          <p>
            {mapUrl ? (
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {ticket.address}
              </a>
            ) : (
              ticket.address
            )}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase text-stone-500 mb-1">
          Issue
        </h2>
        <p className="text-sm whitespace-pre-wrap">{ticket.issue}</p>
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase text-stone-500 mb-1">
          Project
        </h2>
        {project ? (
          <Link href={`/m/projects/${project.id}`} className="text-sm underline">
            {project.title} · {project.status.replace(/_/g, " ")}
          </Link>
        ) : (
          <p className="text-sm text-stone-500">Not linked yet.</p>
        )}
      </section>

      {visits.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium uppercase text-stone-500 mb-1">
            Visits
          </h2>
          <ul className="text-sm space-y-1">
            {visits.map((v: { id: string; type: string; starts_at: string }) => (
              <li key={v.id}>
                <Link href={`/f/jobs/${v.id}`} className="underline capitalize">
                  {v.type}
                </Link>{" "}
                · {new Date(v.starts_at).toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-stone-400">Source: {ticket.source}</p>
    </OpsPage>
  );
}
