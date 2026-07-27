// Ticket detail.

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { Badge } from "@/components/ui/badge";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAppSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const ticket = await withUser(session, async (c) => {
    const { rows } = await c.query(`SELECT * FROM tickets WHERE id = $1`, [id]);
    return rows[0] || null;
  });
  if (!ticket) notFound();

  const project = ticket.project_id
    ? await withUser(session, async (c) => {
        const { rows } = await c.query(
          `SELECT id, title, status FROM projects WHERE id = $1`,
          [ticket.project_id],
        );
        return rows[0] || null;
      })
    : null;

  const mapUrl = ticket.address
    ? `https://maps.google.com/?q=${encodeURIComponent(ticket.address)}`
    : null;

  return (
    <div className="p-4 max-w-xl space-y-4">
      <Link href="/m/service" className="text-sm text-stone-500 hover:underline">
        ← Service
      </Link>
      <div>
        <h1 className="text-xl font-semibold">
          {ticket.contact_name || ticket.address || "Ticket"}
        </h1>
        <div className="mt-1 flex flex-wrap gap-2">
          <Badge>{ticket.status}</Badge>
          <Badge variant={ticket.urgency === "urgent" ? "destructive" : "secondary"}>
            {ticket.urgency}
          </Badge>
          {ticket.classification ? (
            <Badge variant="outline">{ticket.classification}</Badge>
          ) : null}
          {ticket.no_match ? <Badge variant="outline">no matching project</Badge> : null}
        </div>
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
              <a href={mapUrl} target="_blank" rel="noreferrer" className="underline">
                {ticket.address}
              </a>
            ) : (
              ticket.address
            )}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase text-stone-500 mb-1">Issue</h2>
        <p className="text-sm whitespace-pre-wrap">{ticket.issue}</p>
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase text-stone-500 mb-1">Project</h2>
        {project ? (
          <Link href={`/m/projects/${project.id}`} className="text-sm underline">
            {project.title} · {project.status.replace(/_/g, " ")}
          </Link>
        ) : (
          <p className="text-sm text-stone-500">Not linked yet.</p>
        )}
      </section>

      <p className="text-xs text-stone-400">Source: {ticket.source}</p>
    </div>
  );
}
