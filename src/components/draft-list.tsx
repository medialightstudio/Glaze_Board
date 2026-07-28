"use client";

// Propose-only drafts with real Send.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function DraftList({
  drafts,
}: {
  drafts: { id: string; kind: string; body: string; project_id: string | null }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  if (drafts.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium uppercase text-stone-500">Drafts to send</h2>
      <ul className="space-y-2">
        {drafts.map((d) => (
          <li key={d.id} className="rounded border px-3 py-2 text-sm space-y-2">
            <div className="text-xs uppercase text-stone-500">{d.kind.replace(/_/g, " ")}</div>
            <p className="whitespace-pre-wrap text-stone-700">{d.body}</p>
            <button
              type="button"
              disabled={pending}
              className="rounded bg-stone-900 text-white px-3 py-1.5 text-xs disabled:opacity-50"
              onClick={() =>
                start(async () => {
                  const res = await fetch(`/api/drafts/${d.id}/send`, { method: "POST" });
                  const data = (await res.json()) as { error?: string };
                  setMsg(res.ok ? "Sent." : data.error || "Send failed.");
                  if (res.ok) router.refresh();
                })
              }
            >
              Send
            </button>
          </li>
        ))}
      </ul>
      {msg ? <p className="text-xs text-stone-500">{msg}</p> : null}
    </section>
  );
}
