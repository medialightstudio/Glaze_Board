"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function InvoiceActions({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  function run(kind: "final" | "deposit") {
    start(async () => {
      const res = await fetch(`/api/projects/${projectId}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, deposit_percent: 50 }),
      });
      const data = (await res.json()) as { error?: string };
      setMsg(res.ok ? (kind === "deposit" ? "Deposit invoice created." : "Invoice created.") : data.error || "Failed.");
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <button
        type="button"
        disabled={pending}
        onClick={() => run("final")}
        className="rounded bg-stone-900 text-white px-3 py-1.5 text-sm"
      >
        Invoice this job
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run("deposit")}
        className="rounded border px-3 py-1.5 text-sm"
      >
        Deposit 50%
      </button>
      {msg ? <span className="text-xs text-stone-500">{msg}</span> : null}
    </div>
  );
}
