"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ReviewActions({
  itemId,
  alternatives,
  guessedProjectId,
}: {
  itemId: string;
  alternatives: { project_id: string; label: string; score: number }[];
  guessedProjectId: string | null;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(guessedProjectId || "");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  function act(action: "confirm" | "reassign" | "ignore") {
    setError("");
    start(async () => {
      const res = await fetch(`/api/review/${itemId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, project_id: projectId || null }),
      });
      const data = await res.json() as any;
      if (!res.ok) {
        setError(data.error || "Failed.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm">
        Project id
        <input
          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="uuid"
        />
      </label>
      {alternatives?.length ? (
        <div className="flex flex-wrap gap-2">
          {alternatives.map((a) => (
            <button
              key={a.project_id}
              type="button"
              className="text-xs rounded border px-2 py-1 hover:bg-stone-50"
              onClick={() => setProjectId(a.project_id)}
            >
              {a.label} ({Math.round(a.score * 100)}%)
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          disabled={pending}
          onClick={() => act("confirm")}
          className="rounded bg-stone-900 text-white px-3 py-1.5 text-sm"
        >
          Confirm
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act("reassign")}
          className="rounded border px-3 py-1.5 text-sm"
        >
          Reassign
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act("ignore")}
          className="rounded border px-3 py-1.5 text-sm text-stone-600"
        >
          Ignore
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
