// Project screen — next action, glass/hardware chips, feed.

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { getProject } from "@/lib/db";
import { nextActionFor, type Status } from "@/lib/status-machine";
import { Badge } from "@/components/ui/badge";
import {
  GlassChip,
  HardwareChip,
  NextActionButton,
  UploadDoc,
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
    const glass = await c.query(
      `SELECT id, status, po_number FROM glass_orders WHERE project_id = $1 ORDER BY created_at`,
      [id],
    );
    const hardware = await c.query(
      `SELECT id, status, partial FROM hardware_orders WHERE project_id = $1 ORDER BY created_at LIMIT 1`,
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
    return {
      project,
      glass: glass.rows,
      hardware: hardware.rows[0] || null,
      feed: feed.rows,
      docs: docs.rows,
      bridgeOn: Boolean(
        company.rows[0]?.crl_bridge_enabled && company.rows[0]?.crl_tos_accepted,
      ),
    };
  });
  if (!data) notFound();

  const { project, glass, hardware, feed, docs, bridgeOn } = data;
  const next = nextActionFor(project.status as Status);
  const mapUrl = `https://maps.google.com/?q=${encodeURIComponent(project.site_address)}`;
  const margin = marginCents(
    project.quote_price_cents || 0,
    project.margin_glass_cents || 0,
    project.margin_hardware_cents || 0,
  );

  return (
    <div className="p-4 max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{project.title}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge>{project.status.replace(/_/g, " ")}</Badge>
          <a href={mapUrl} target="_blank" rel="noreferrer" className="text-sm text-stone-600 underline">
            {project.site_address}
          </a>
        </div>
        {project.note ? <p className="mt-2 text-sm text-stone-600">{project.note}</p> : null}
      </div>

      <section className="rounded-lg border bg-stone-50 p-3 text-sm space-y-1">
        <h2 className="text-sm font-medium uppercase text-stone-500">Access</h2>
        <p>
          Lockbox:{" "}
          <span className="font-medium">{project.access_lockbox_code || "—"}</span>
        </p>
        <p className="text-stone-700">{project.access_notes || "No access notes."}</p>
      </section>

      <section className="text-sm text-stone-600">
        Margin {formatCents(margin)}{" "}
        <span className="text-stone-400">
          (price {formatCents(project.quote_price_cents || 0)} − glass{" "}
          {formatCents(project.margin_glass_cents || 0)} − hardware{" "}
          {formatCents(project.margin_hardware_cents || 0)})
        </span>
      </section>

      <div className="flex flex-wrap gap-2 items-center">
        <GlassChip projectId={id} order={glass[0] || null} />
        <HardwareChip projectId={id} order={hardware} />
        {glass.slice(1).map((g: { id: string; status: string; po_number: string }) => (
          <GlassChip key={g.id} projectId={id} order={g} />
        ))}
      </div>

      {next ? (
        <NextActionButton projectId={id} label={next.label} to={next.to} />
      ) : (
        <p className="text-sm text-stone-500">No next action for this status.</p>
      )}

      {["installed", "invoiced", "measured", "quote_sent", "approved", "ordering", "ready_to_schedule", "install_scheduled"].includes(
        project.status,
      ) ? (
        <div className="space-y-3">
          <InvoiceActions projectId={id} />
          <ChangeOrderForm projectId={id} />
        </div>
      ) : null}

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

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium uppercase text-stone-500">Feed</h2>
          <UploadDoc projectId={id} />
        </div>
        <ul className="space-y-2">
          {docs.map((d: { id: string; file: string; type: string }) => (
            <li key={d.id} className="text-sm rounded border px-3 py-2">
              <a href={`/api/documents/${d.id}`} className="underline" target="_blank" rel="noreferrer">
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
      </section>

      <p className="text-xs text-stone-400">
        <Link href="/m/pipeline" className="underline">
          Pipeline
        </Link>
      </p>
    </div>
  );
}
