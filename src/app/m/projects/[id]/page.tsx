// Project hub — contacts, access, chips, one next-action, feed, details.

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { getProject, getAccount } from "@/lib/db";
import { nextActionFor, type Status } from "@/lib/status-machine";
import { Badge } from "@/components/ui/badge";
import { OpsPage, OpsSection } from "@/components/ops/ops-page";
import {
  GlassChip,
  HardwareChip,
  NextActionButton,
  UploadDoc,
  AccessEditor,
  AddProjectContact,
} from "./actions";
import { DropPin } from "./drop-pin";
import { CrlPanel } from "./crl-panel";
import { formatSendToCrl } from "@/lib/bridge";
import { formatCents, marginCents } from "@/lib/money";
import { InvoiceActions } from "./invoice-actions";
import { ChangeOrderForm } from "./change-order";
import { SmsThread } from "./sms-thread";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAppSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const data = await withUser(session, async (c) => {
    const project = await getProject(c, id);
    if (!project) return null;
    const account = await getAccount(c, project.account_id);
    const glass = await c.query(
      `SELECT id, status, po_number FROM glass_orders WHERE project_id = $1 ORDER BY created_at`,
      [id],
    );
    const hardware = await c.query(
      `SELECT id, status, partial, order_number, fulfillment
       FROM hardware_orders WHERE project_id = $1 ORDER BY created_at LIMIT 1`,
      [id],
    );
    const feed = await c.query(
      `SELECT id, actor, verb, details, created_at
       FROM activity_events WHERE project_id = $1
       ORDER BY created_at DESC LIMIT 40`,
      [id],
    );
    const docs = await c.query(
      `SELECT id, file, type, created_at FROM documents WHERE project_id = $1 ORDER BY created_at DESC`,
      [id],
    );
    const company = await c.query(
      `SELECT crl_bridge_enabled, crl_tos_accepted FROM companies WHERE id = $1`,
      [session.companyId],
    );
    const contacts = await c.query(
      `SELECT pc.role, c.id, c.name, c.phone, c.email
       FROM project_contacts pc
       JOIN contacts c ON c.id = pc.contact_id
       WHERE pc.project_id = $1
       ORDER BY pc.is_primary DESC, c.name`,
      [id],
    );
    const accountContacts = await c.query(
      `SELECT id, name, phone, email FROM contacts WHERE account_id = $1 ORDER BY name LIMIT 20`,
      [project.account_id],
    );
    const visits = await c.query(
      `SELECT id, type, starts_at::text, assignees
       FROM visits WHERE project_id = $1
       ORDER BY starts_at DESC LIMIT 10`,
      [id],
    );
    const tickets = await c.query(
      `SELECT id, issue, status, urgency FROM tickets
       WHERE project_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [id],
    );
    const quotes = await c.query(
      `SELECT id, status, total_cents FROM quotes
       WHERE project_id = $1 ORDER BY updated_at DESC LIMIT 5`,
      [id],
    );
    const invoices = await c.query(
      `SELECT i.id, i.kind, i.status, i.total_cents, i.qb_invoice_id
       FROM invoices i
       WHERE EXISTS (
         SELECT 1 FROM invoice_lines l WHERE l.invoice_id = i.id AND l.project_id = $1
       )
       ORDER BY i.created_at DESC LIMIT 5`,
      [id],
    );
    const users = await c.query(
      `SELECT id, name FROM "user" WHERE company_id = $1 AND active = true ORDER BY name`,
      [session.companyId],
    );
    const todayVisit = await c.query(
      `SELECT id FROM visits
       WHERE project_id = $1
         AND starts_at::date = (now() AT TIME ZONE coalesce(
           (SELECT timezone FROM companies WHERE id = $2), 'America/Los_Angeles'
         ))::date
       ORDER BY starts_at LIMIT 1`,
      [id, session.companyId],
    );
    return {
      project,
      account,
      glass: glass.rows,
      hardware: hardware.rows[0] || null,
      feed: feed.rows,
      docs: docs.rows,
      bridgeOn: Boolean(
        company.rows[0]?.crl_bridge_enabled && company.rows[0]?.crl_tos_accepted,
      ),
      contacts: contacts.rows,
      accountContacts: accountContacts.rows,
      visits: visits.rows,
      tickets: tickets.rows,
      quotes: quotes.rows,
      invoices: invoices.rows,
      users: users.rows,
      todayVisitId: todayVisit.rows[0]?.id as string | undefined,
    };
  });
  if (!data) notFound();

  const {
    project,
    account,
    glass,
    hardware,
    feed,
    docs,
    bridgeOn,
    contacts,
    visits,
    tickets,
    quotes,
    invoices,
    users,
    todayVisitId,
  } = data;
  const next = nextActionFor(project.status as Status);
  const mapUrl = `https://maps.google.com/?q=${encodeURIComponent(project.site_address)}`;
  const margin = marginCents(
    project.quote_price_cents || 0,
    project.margin_glass_cents || 0,
    project.margin_hardware_cents || 0,
  );

  const shownContacts =
    contacts.length > 0
      ? contacts
      : data.accountContacts.slice(0, 3).map(
          (c: { id: string; name: string; phone?: string; email?: string }) => ({
            ...c,
            role: "customer",
          }),
        );

  return (
    <OpsPage title={project.title}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{project.status.replace(/_/g, " ")}</Badge>
        {account ? (
          <Link
            href={`/m/customers/${account.id}`}
            className="text-sm text-stone-700 underline"
          >
            {account.name}
          </Link>
        ) : null}
        <a
          href={mapUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-stone-600 underline"
        >
          {project.site_address}
        </a>
      </div>
      {project.note ? (
        <p className="text-sm text-stone-600 -mt-2">{project.note}</p>
      ) : null}

      <OpsSection title="Contacts">
        <ul className="flex flex-wrap gap-2">
          {shownContacts.map(
            (c: {
              id: string;
              name: string;
              phone?: string;
              email?: string;
              role: string;
            }) => (
              <li
                key={`${c.id}-${c.role}`}
                className="rounded border px-2 py-1.5 text-sm flex flex-col gap-0.5 min-w-[8rem]"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-[10px] uppercase text-stone-400">
                  {c.role}
                </span>
                <span className="flex gap-2 text-xs">
                  {c.phone ? (
                    <>
                      <a href={`tel:${c.phone}`} className="underline">
                        Call
                      </a>
                      <a href={`sms:${c.phone}`} className="underline">
                        Text
                      </a>
                    </>
                  ) : (
                    <span className="text-stone-400">No phone</span>
                  )}
                </span>
              </li>
            ),
          )}
          {shownContacts.length === 0 ? (
            <li className="text-sm text-stone-500">No contacts yet.</li>
          ) : null}
        </ul>
        <AddProjectContact projectId={id} />
      </OpsSection>

      <OpsSection title="Access">
        <AccessEditor
          projectId={id}
          lockbox={project.access_lockbox_code}
          notes={project.access_notes}
        />
      </OpsSection>

      <OpsSection title="Supply">
        <div className="flex flex-wrap gap-2 items-center">
          <GlassChip projectId={id} order={glass[0] || null} />
          <HardwareChip projectId={id} order={hardware} />
          {glass.slice(1).map((g: { id: string; status: string; po_number: string }) => (
            <GlassChip key={g.id} projectId={id} order={g} />
          ))}
        </div>
      </OpsSection>

      <div>
        {next ? (
          <NextActionButton projectId={id} next={next} users={users} />
        ) : (
          <p className="text-sm text-stone-500">No next action for this status.</p>
        )}
      </div>

      {next?.tool !== "invoice" &&
      ["installed", "invoiced", "approved", "ordering", "ready_to_schedule", "install_scheduled"].includes(
        project.status,
      ) ? (
        <div className="space-y-3">
          <InvoiceActions projectId={id} />
          <ChangeOrderForm projectId={id} />
        </div>
      ) : null}
      {next?.tool === "invoice" ? <ChangeOrderForm projectId={id} /> : null}

      <details className="rounded border px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium text-stone-700">
          Details
        </summary>
        <div className="mt-3 space-y-3 text-stone-600">
          <p>
            Margin {formatCents(margin)}{" "}
            <span className="text-stone-400">
              (price {formatCents(project.quote_price_cents || 0)} − glass{" "}
              {formatCents(project.margin_glass_cents || 0)} − hardware{" "}
              {formatCents(project.margin_hardware_cents || 0)})
            </span>
          </p>
          <div>
            <div className="text-xs uppercase text-stone-400 mb-1">Quotes</div>
            {quotes.length === 0 ? (
              <span className="text-stone-400">None</span>
            ) : (
              <ul className="space-y-1">
                {quotes.map(
                  (q: { id: string; status: string; total_cents: number }) => (
                    <li key={q.id}>
                      <Link href={`/m/quotes/${q.id}`} className="underline">
                        {q.status} · {formatCents(q.total_cents || 0)}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
          <div>
            <div className="text-xs uppercase text-stone-400 mb-1">Invoices</div>
            {invoices.length === 0 ? (
              <span className="text-stone-400">None</span>
            ) : (
              <ul className="space-y-1">
                {invoices.map(
                  (inv: {
                    id: string;
                    kind?: string;
                    status?: string;
                    total_cents?: number;
                  }) => (
                    <li key={inv.id}>
                      {inv.kind || "invoice"} · {inv.status || "—"} ·{" "}
                      {formatCents(inv.total_cents || 0)}
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
          <div>
            <div className="text-xs uppercase text-stone-400 mb-1">Visits</div>
            {visits.length === 0 ? (
              <span className="text-stone-400">None</span>
            ) : (
              <ul className="space-y-1">
                {visits.map(
                  (v: { id: string; type: string; starts_at: string }) => (
                    <li key={v.id}>
                      <Link href={`/f/jobs/${v.id}`} className="underline capitalize">
                        {v.type}
                      </Link>{" "}
                      · {new Date(v.starts_at).toLocaleString()}
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
          <div>
            <div className="text-xs uppercase text-stone-400 mb-1">Tickets</div>
            {tickets.length === 0 ? (
              <span className="text-stone-400">None</span>
            ) : (
              <ul className="space-y-1">
                {tickets.map(
                  (t: { id: string; issue: string; urgency?: string }) => (
                    <li key={t.id}>
                      <Link href={`/m/service/${t.id}`} className="underline">
                        {t.issue}
                      </Link>
                      {t.urgency === "urgent" ? (
                        <span className="ml-1 text-red-600">urgent</span>
                      ) : null}
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        </div>
      </details>

      <DropPin projectId={id} lat={project.lat} lng={project.lng} />

      <CrlPanel
        projectId={id}
        bridgeEnabled={bridgeOn}
        block={formatSendToCrl({
          title: project.title,
          site_address: project.site_address,
          measurements: project.measurements,
        })}
      />

      <SmsThread projectId={id} />

      <OpsSection title="Feed">
        <div className="flex justify-end -mt-8 mb-2">
          <UploadDoc projectId={id} />
        </div>
        <ul className="space-y-2">
          {docs.map((d: { id: string; file: string; type: string }) => (
            <li key={d.id} className="text-sm rounded border px-3 py-2">
              <a
                href={`/api/documents/${d.id}`}
                className="underline"
                target="_blank"
                rel="noreferrer"
              >
                {d.file}
              </a>
              <span className="text-stone-500 ml-2">{d.type}</span>
            </li>
          ))}
          {feed.map(
            (e: {
              id: string;
              actor: string;
              verb: string;
              details: Record<string, unknown>;
              created_at: string;
            }) => (
              <li key={e.id} className="text-sm rounded border px-3 py-2">
                <span className="font-medium">{e.verb.replace(/_/g, " ")}</span>
                <span className="text-stone-500 ml-2">
                  {e.actor}
                  {e.details?.from
                    ? ` · ${String(e.details.from)} → ${String(e.details.to)}`
                    : ""}
                </span>
                <div className="text-xs text-stone-400">
                  {new Date(e.created_at).toLocaleString()}
                </div>
              </li>
            ),
          )}
          {feed.length + docs.length === 0 ? (
            <li className="text-sm text-stone-500">Nothing yet.</li>
          ) : null}
        </ul>
      </OpsSection>

      <p className="text-xs text-stone-400 flex flex-wrap gap-3">
        <Link href="/m/pipeline" className="underline">
          Pipeline
        </Link>
        <Link href="/m/dispatch" className="underline">
          Dispatch
        </Link>
        {todayVisitId ? (
          <Link href={`/f/jobs/${todayVisitId}`} className="underline">
            Field job today
          </Link>
        ) : null}
      </p>
    </OpsPage>
  );
}
