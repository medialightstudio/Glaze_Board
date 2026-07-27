"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/money";

type Line = { description: string; qty: number; unit_cents: number };

export function QuoteEditor({
  quoteId,
  initial,
}: {
  quoteId: string;
  initial: {
    homeowner_name: string;
    terms: string;
    project_id: string;
    crl_quote_number: string;
    lines: Line[];
    pdf_document_id?: string | null;
    share_url?: string | null;
  };
}) {
  const router = useRouter();
  const [homeowner, setHomeowner] = useState(initial.homeowner_name);
  const [terms, setTerms] = useState(initial.terms);
  const [projectId, setProjectId] = useState(initial.project_id);
  const [crl, setCrl] = useState(initial.crl_quote_number);
  const [lines, setLines] = useState<Line[]>(
    initial.lines.length ? initial.lines : [{ description: "", qty: 1, unit_cents: 0 }],
  );
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const total = lines.reduce((s, l) => s + Math.round(l.qty * l.unit_cents), 0);

  function save(extra?: Record<string, unknown>) {
    setMsg("");
    start(async () => {
      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeowner_name: homeowner,
          terms,
          project_id: projectId || null,
          crl_quote_number: crl || null,
          lines,
          ...extra,
        }),
      });
      const data = await res.json() as any;
      if (!res.ok) {
        setMsg(data.error || "Save failed.");
        return;
      }
      setMsg(extra?.action === "generate_pdf" ? "PDF ready." : extra?.action === "send" ? "Marked sent." : "Saved.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm block">
          Homeowner
          <input
            className="mt-1 w-full rounded border px-2 py-1.5"
            value={homeowner}
            onChange={(e) => setHomeowner(e.target.value)}
          />
        </label>
        <label className="text-sm block">
          Project id
          <input
            className="mt-1 w-full rounded border px-2 py-1.5"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          />
        </label>
        <label className="text-sm block sm:col-span-2">
          CRL quote #
          <input
            className="mt-1 w-full rounded border px-2 py-1.5"
            value={crl}
            onChange={(e) => setCrl(e.target.value)}
          />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-medium uppercase text-stone-500">Lines</h2>
          <button
            type="button"
            className="text-sm underline"
            onClick={() => setLines([...lines, { description: "", qty: 1, unit_cents: 0 }])}
          >
            Add line
          </button>
        </div>
        {lines.map((line, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2">
            <input
              className="col-span-6 rounded border px-2 py-1.5 text-sm"
              placeholder="Description"
              value={line.description}
              onChange={(e) => {
                const next = [...lines];
                next[idx] = { ...line, description: e.target.value };
                setLines(next);
              }}
            />
            <input
              type="number"
              className="col-span-2 rounded border px-2 py-1.5 text-sm"
              value={line.qty}
              onChange={(e) => {
                const next = [...lines];
                next[idx] = { ...line, qty: Number(e.target.value) };
                setLines(next);
              }}
            />
            <input
              type="number"
              className="col-span-3 rounded border px-2 py-1.5 text-sm"
              placeholder="cents"
              value={line.unit_cents}
              onChange={(e) => {
                const next = [...lines];
                next[idx] = { ...line, unit_cents: Number(e.target.value) };
                setLines(next);
              }}
            />
            <button
              type="button"
              className="col-span-1 text-stone-400"
              onClick={() => setLines(lines.filter((_, i) => i !== idx))}
            >
              ×
            </button>
          </div>
        ))}
        <div className="text-right font-medium sticky bottom-0 bg-white py-2">
          Total {formatCents(total)}
        </div>
      </div>

      <label className="text-sm block">
        Terms
        <textarea
          className="mt-1 w-full rounded border px-2 py-1.5"
          rows={3}
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
        />
      </label>

      <div className="flex flex-wrap gap-2 sticky bottom-0 bg-white py-2 border-t">
        <button
          type="button"
          disabled={pending}
          onClick={() => save()}
          className="rounded border px-3 py-2 text-sm"
        >
          Save
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => save({ action: "generate_pdf" })}
          className="rounded bg-stone-900 text-white px-3 py-2 text-sm"
        >
          Generate PDF
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => save({ action: "send" })}
          className="rounded border px-3 py-2 text-sm"
        >
          Mark sent
        </button>
        {initial.pdf_document_id ? (
          <a
            className="rounded border px-3 py-2 text-sm underline"
            href={`/api/documents/${initial.pdf_document_id}`}
            target="_blank"
            rel="noreferrer"
          >
            Open PDF
          </a>
        ) : null}
        {initial.share_url ? (
          <button
            type="button"
            className="rounded border px-3 py-2 text-sm"
            onClick={() => navigator.clipboard.writeText(window.location.origin + initial.share_url!)}
          >
            Copy share link
          </button>
        ) : null}
      </div>
      {msg ? <p className="text-sm text-stone-600">{msg}</p> : null}
    </div>
  );
}
