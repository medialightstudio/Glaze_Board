"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ReviewActions({
  itemId,
  alternatives,
  guessedProjectId,
}: {
  itemId: string;
  alternatives: {
    project_id: string;
    label: string;
    score: number;
    glass_order_id?: string;
    hardware_order_id?: string;
  }[];
  guessedProjectId: string | null;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(guessedProjectId || "");
  const [glassId, setGlassId] = useState("");
  const [hwId, setHwId] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  function pick(a: {
    project_id: string;
    glass_order_id?: string;
    hardware_order_id?: string;
  }) {
    setProjectId(a.project_id);
    setGlassId(a.glass_order_id || "");
    setHwId(a.hardware_order_id || "");
  }

  function act(action: "confirm" | "reassign" | "ignore") {
    setError("");
    start(async () => {
      const res = await fetch(`/api/review/${itemId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          project_id: projectId || null,
          glass_order_id: glassId || undefined,
          hardware_order_id: hwId || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Failed.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {alternatives?.length ? (
        <div className="flex flex-wrap gap-2">
          {alternatives.map((a) => (
            <button
              key={`${a.project_id}-${a.glass_order_id || a.hardware_order_id || ""}`}
              type="button"
              className="text-xs rounded border px-2 py-1 hover:bg-stone-50"
              onClick={() => pick(a)}
            >
              {a.label} ({Math.round(a.score * 100)}%)
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-stone-500">No ranked alternatives — paste a project id.</p>
      )}
      <label className="block text-sm">
        Project id
        <input
          className="mt-1 w-full rounded border px-2 py-1.5 text-sm font-mono"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        />
      </label>
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
