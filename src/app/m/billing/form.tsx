"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/money";

type Job = {
  id: string;
  title: string;
  account_id: string;
  account_name: string;
  amount_cents: number;
};

export function BillingForm({ unbilled }: { unbilled: Job[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(unbilled.map((j) => [j.id, true])),
  );
  const [accountId, setAccountId] = useState(unbilled[0]?.account_id || "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  const accounts = useMemo(() => {
    const map = new Map<string, string>();
    for (const j of unbilled) map.set(j.account_id, j.account_name);
    return [...map.entries()];
  }, [unbilled]);

  const jobs = unbilled.filter((j) => j.account_id === accountId);

  function create(kind: "final" | "deposit" = "final") {
    setMsg("");
    const projectIds = jobs.filter((j) => selected[j.id]).map((j) => j.id);
    if (!accountId || projectIds.length === 0) {
      setMsg("Pick at least one job.");
      return;
    }
    start(async () => {
      const res = await fetch("/api/billing/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          project_ids: projectIds,
          kind,
          deposit_percent: 50,
        }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        setMsg(data.error || "Failed.");
        return;
      }
      setMsg(
        `${kind === "deposit" ? "Deposit" : "Invoice"} created${
          data.qb_invoice_id ? ` · QB #${data.qb_invoice_id}` : ""
        }.`,
      );
      router.refresh();
    });
  }

  if (unbilled.length === 0) {
    return <p className="text-sm text-stone-500">No completed unbilled jobs.</p>;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase text-stone-500">Create invoice</h2>
      <label className="text-sm block">
        Customer
        <select
          className="mt-1 w-full rounded border px-2 py-2"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          {accounts.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <ul className="space-y-2">
        {jobs.map((j) => (
          <li key={j.id} className="flex items-center gap-3 text-sm border rounded px-3 py-2">
            <input
              type="checkbox"
              checked={Boolean(selected[j.id])}
              onChange={(e) => setSelected({ ...selected, [j.id]: e.target.checked })}
            />
            <span className="flex-1">{j.title}</span>
            <span className="tabular-nums">{formatCents(j.amount_cents)}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => create("final")}
          className="rounded bg-stone-900 text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create & send"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => create("deposit")}
          className="rounded border px-4 py-2 text-sm disabled:opacity-50"
        >
          Deposit 50%
        </button>
      </div>
      {msg ? <p className="text-sm text-stone-600">{msg}</p> : null}
    </section>
  );
}
