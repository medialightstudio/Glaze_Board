"use client";

// CRL L0 — copy measurements for human entry; optional L1 enqueue when enabled.

import { useState, useTransition } from "react";

export function CrlPanel({
  projectId,
  block,
  bridgeEnabled,
}: {
  projectId: string;
  block: string;
  bridgeEnabled: boolean;
}) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  return (
    <section className="rounded-lg border p-3 space-y-2">
      <h2 className="text-sm font-medium uppercase text-stone-500">Send to CRL</h2>
      <p className="text-xs text-stone-500">
        Level 0 — copy into CRL Showers Online. Ordering stays human.
      </p>
      <pre className="text-xs whitespace-pre-wrap rounded bg-stone-50 border p-2">{block}</pre>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border px-3 py-1.5 text-sm"
          onClick={() => {
            navigator.clipboard.writeText(block);
            setMsg("Copied.");
          }}
        >
          Copy block
        </button>
        {bridgeEnabled ? (
          <button
            type="button"
            disabled={pending}
            className="rounded bg-stone-900 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            onClick={() =>
              start(async () => {
                const res = await fetch("/api/bridge/jobs", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ project_id: projectId, level: 1 }),
                });
                const data = await res.json() as any;
                setMsg(res.ok ? "Bridge job queued." : data.error || "Failed.");
              })
            }
          >
            Start Bridge L1
          </button>
        ) : (
          <span className="text-xs text-stone-400 self-center">Bridge L1 off (needs D4).</span>
        )}
      </div>
      {msg ? <p className="text-xs text-stone-600">{msg}</p> : null}
    </section>
  );
}
