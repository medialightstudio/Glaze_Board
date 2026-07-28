"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ChangeOrderForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [desc, setDesc] = useState("");
  const [cents, setCents] = useState(0);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-wrap gap-2 items-end text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await fetch("/api/billing/change-orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              project_id: projectId,
              description: desc,
              amount_cents: cents,
            }),
          });
          setDesc("");
          setCents(0);
          router.refresh();
        });
      }}
    >
      <label>
        Change order
        <input
          className="mt-1 block rounded border px-2 py-1"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          required
        />
      </label>
      <label>
        Cents
        <input
          type="number"
          className="mt-1 block rounded border px-2 py-1 w-28"
          value={cents}
          onChange={(e) => setCents(Number(e.target.value))}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded border px-3 py-1.5 disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}
