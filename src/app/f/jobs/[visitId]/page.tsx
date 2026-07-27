// Field job screen — docs, access, complete CTA.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { CompleteVisit } from "./complete";

export default async function FieldJobPage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const session = await getAppSession();
  if (!session) redirect("/login");
  const { visitId } = await params;

  const data = await withUser(session, async (c) => {
    const v = await c.query(
      `SELECT v.*, p.title, p.site_address, p.status, p.lockbox_code, p.access_notes, p.note, p.id AS project_id
       FROM visits v
       LEFT JOIN projects p ON p.id = v.project_id
       WHERE v.id = $1`,
      [visitId],
    );
    const visit = v.rows[0];
    if (!visit) return null;
    const docs = await c.query(
      `SELECT id, file, type FROM documents WHERE project_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [visit.project_id],
    );
    return { visit, docs: docs.rows };
  });
  if (!data) notFound();

  const { visit, docs } = data;
  const maps = `https://maps.google.com/?q=${encodeURIComponent(visit.site_address || "")}`;

  return (
    <main className="p-4 max-w-lg mx-auto space-y-5 pb-24">
      <Link href="/f" className="text-sm text-stone-500 underline">
        ← Today
      </Link>
      <header>
        <p className="text-xs uppercase tracking-wide text-stone-500">{visit.type}</p>
        <h1 className="text-xl font-semibold">{visit.title}</h1>
        <a href={maps} className="text-sm underline text-stone-700" target="_blank" rel="noreferrer">
          {visit.site_address}
        </a>
        <p className="text-sm text-stone-500 mt-1">Status: {String(visit.status).replace(/_/g, " ")}</p>
      </header>

      <section className="rounded-lg border bg-stone-50 p-3 space-y-1">
        <h2 className="text-sm font-medium uppercase text-stone-500">Access</h2>
        <p className="text-sm">
          Lockbox: <span className="font-medium">{visit.lockbox_code || "—"}</span>
        </p>
        <p className="text-sm text-stone-700">{visit.access_notes || "No access notes."}</p>
      </section>

      {visit.note ? (
        <section>
          <h2 className="text-sm font-medium uppercase text-stone-500 mb-1">Notes</h2>
          <p className="text-sm text-stone-700">{visit.note}</p>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-medium uppercase text-stone-500 mb-2">Drawings & photos</h2>
        {docs.length === 0 ? (
          <p className="text-sm text-stone-500">No documents yet.</p>
        ) : (
          <ul className="space-y-2">
            {docs.map((d: { id: string; file: string; type: string }) => (
              <li key={d.id}>
                <a
                  href={`/api/documents/${d.id}`}
                  className="text-sm underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {d.file}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!visit.completed_at ? (
        <CompleteVisit visitId={visitId} projectId={visit.project_id} type={visit.type} />
      ) : (
        <p className="text-sm text-green-700">Completed.</p>
      )}
    </main>
  );
}
