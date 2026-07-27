"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function CustomerInvoiceButton({
  accountId,
  projectIds,
}: {
  accountId: string;
  projectIds: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending || projectIds.length === 0}
        className="rounded bg-stone-900 text-white px-3 py-1.5 text-sm disabled:opacity-50"
        onClick={() =>
          start(async () => {
            const res = await fetch("/api/billing/invoices", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ account_id: accountId, project_ids: projectIds }),
            });
            const data = await res.json() as any;
            setMsg(res.ok ? "Invoice created." : data.error || "Failed.");
            if (res.ok) router.refresh();
          })
        }
      >
        {pending ? "…" : "Generate invoice"}
      </button>
      {msg ? <p className="text-xs text-stone-500">{msg}</p> : null}
    </div>
  );
}
