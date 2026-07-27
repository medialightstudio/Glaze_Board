// Review Queue — PDF left, AI guess right; Confirm / Reassign / Ignore.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { ReviewActions } from "./actions";
import { OpsPage } from "@/components/ops/ops-page";

export default async function ReviewPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  const items = await withUser(session, async (c) => {
    const { rows } = await c.query(
      `SELECT r.*, d.file, d.id AS doc_id
       FROM review_queue_items r
       LEFT JOIN documents d ON d.id = r.document_id
       WHERE r.status = 'open'
       ORDER BY r.created_at ASC
       LIMIT 40`,
    );
    return rows;
  });

  return (
    <OpsPage
      title="Review Queue"
      purpose="Confirm matches before anything advances silently."
      wide
      actions={
        <span className="text-sm text-stone-600">{items.length} open</span>
      }
    >
      {items.length === 0 ? (
        <p className="text-stone-600 py-10 text-center">Queue is clear.</p>
      ) : (
        <ul className="space-y-6">
          {items.map(
            (item: {
              id: string;
              doc_id: string;
              file: string;
              confidence: number;
              extract: Record<string, unknown>;
              guessed_project_id: string | null;
              alternatives: { project_id: string; label: string; score: number }[];
            }) => (
              <li
                key={item.id}
                className="grid gap-4 md:grid-cols-2 rounded-lg border bg-white overflow-hidden review-pane"
              >
                <div className="bg-stone-50 p-3 min-h-48 border-b md:border-b-0 md:border-r">
                  <p className="text-xs uppercase text-stone-500 mb-2">Document</p>
                  {item.doc_id ? (
                    <a
                      href={`/api/documents/${item.doc_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-sm"
                    >
                      {item.file || "Open file"}
                    </a>
                  ) : (
                    <p className="text-sm text-stone-500">No file</p>
                  )}
                  <pre className="mt-3 text-xs whitespace-pre-wrap text-stone-700 max-h-56 overflow-auto">
                    {JSON.stringify(item.extract || {}, null, 2)}
                  </pre>
                </div>
                <div className="p-3 space-y-3">
                  <p className="text-xs uppercase text-stone-500">Decision</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Confidence</span>
                    <div className="flex-1 h-2 rounded bg-stone-100 overflow-hidden">
                      <div
                        className="h-full bg-stone-800 transition-all duration-500"
                        style={{ width: `${Math.round((Number(item.confidence) || 0) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm tabular-nums">
                      {Math.round((Number(item.confidence) || 0) * 100)}%
                    </span>
                  </div>
                  {item.guessed_project_id ? (
                    <p className="text-sm">
                      Best guess:{" "}
                      <Link className="underline" href={`/m/projects/${item.guessed_project_id}`}>
                        open project
                      </Link>
                    </p>
                  ) : (
                    <p className="text-sm text-stone-500">No project guess yet.</p>
                  )}
                  <ReviewActions
                    itemId={item.id}
                    alternatives={item.alternatives || []}
                    guessedProjectId={item.guessed_project_id}
                  />
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </OpsPage>
  );
}
