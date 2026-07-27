"use client";

import { useState, useTransition } from "react";

const KEYS = [
  { key: "auto_file_docs", label: "Auto-file high-confidence documents" },
  { key: "auto_advance_procurement", label: "Auto-advance procurement (≥0.9)" },
  { key: "auto_match_tickets", label: "Auto-match tickets" },
  { key: "draft_gate_messages", label: "Draft gate / follow-up messages" },
];

export function AutonomyToggles({
  initial,
  isAdmin,
}: {
  initial: Record<string, boolean>;
  isAdmin: boolean;
}) {
  const [toggles, setToggles] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  function save(next: Record<string, boolean>) {
    setToggles(next);
    if (!isAdmin) return;
    start(async () => {
      const res = await fetch("/api/settings/autonomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toggles: next }),
      });
      setMsg(res.ok ? "Saved." : "Could not save.");
    });
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium uppercase text-stone-500">AI autonomy</h2>
      <p className="text-xs text-stone-500">All off by default. Money and ordering stay human.</p>
      {KEYS.map((k) => (
        <label key={k.key} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
          <span>{k.label}</span>
          <input
            type="checkbox"
            disabled={!isAdmin || pending}
            checked={Boolean(toggles[k.key])}
            onChange={(e) => save({ ...toggles, [k.key]: e.target.checked })}
          />
        </label>
      ))}
      {msg ? <p className="text-xs text-stone-500">{msg}</p> : null}
    </section>
  );
}
