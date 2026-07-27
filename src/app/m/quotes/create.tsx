"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function CreateQuoteButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="rounded bg-stone-900 text-white px-3 py-1.5 text-sm disabled:opacity-50"
      onClick={() =>
        start(async () => {
          const res = await fetch("/api/quotes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          const data = await res.json() as any;
          if (res.ok && data.id) router.push(`/m/quotes/${data.id}`);
        })
      }
    >
      {pending ? "…" : "New quote"}
    </button>
  );
}
