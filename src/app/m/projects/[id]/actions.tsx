"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookVisitSheet } from "@/components/ops/book-visit-sheet";
import { InvoiceActions } from "./invoice-actions";
import type { NextAction } from "@/lib/status-machine";

export function NextActionButton({
  projectId,
  next,
  users,
}: {
  projectId: string;
  next: NextAction;
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [ask, setAsk] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);

  async function go(extra: Record<string, string> = {}) {
    if (!next.to) return;
    setBusy(true);
    await fetch(`/api/projects/${projectId}/transition`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: next.to, note: note || undefined, ...extra }),
    });
    setBusy(false);
    setAsk(false);
    router.refresh();
  }

  if (next.tool === "book_measure" || next.tool === "book_install") {
    const type = next.tool === "book_measure" ? "measure" : "install";
    return (
      <>
        <Button onClick={() => setBookOpen(true)} disabled={busy}>
          {next.label}
        </Button>
        <BookVisitSheet
          users={users}
          projectId={projectId}
          defaultType={type}
          triggerLabel={next.label}
          open={bookOpen}
          onOpenChange={setBookOpen}
          hideTrigger
        />
      </>
    );
  }

  if (next.tool === "create_quote") {
    return (
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch("/api/quotes", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ project_id: projectId }),
          });
          const data = (await res.json()) as { id?: string };
          setBusy(false);
          if (res.ok && data.id) router.push(`/m/quotes/${data.id}`);
          else router.refresh();
        }}
      >
        {next.label}
      </Button>
    );
  }

  if (next.tool === "invoice") {
    return (
      <div className="space-y-2">
        {!showInvoice ? (
          <Button onClick={() => setShowInvoice(true)}>{next.label}</Button>
        ) : (
          <InvoiceActions projectId={projectId} />
        )}
      </div>
    );
  }

  if (next.to === "approved" && !ask) {
    return (
      <Button onClick={() => setAsk(true)} disabled={busy}>
        {next.label}
      </Button>
    );
  }
  if (next.to === "approved" && ask) {
    return (
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          className="max-w-xs"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button disabled={busy} onClick={() => go({ method: "tap" })}>
          Confirm approved
        </Button>
        <Button variant="ghost" onClick={() => setAsk(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button disabled={busy || !next.to} onClick={() => go()}>
      {next.label}
    </Button>
  );
}

const GLASS_NEXT: Record<string, string> = {
  not_ordered: "po_sent",
  po_sent: "acknowledged",
  acknowledged: "shipped",
  shipped: "received",
};

const HW_NEXT: Record<string, string> = {
  not_started: "in_cart",
  in_cart: "ordered",
  ordered: "received",
};

export function GlassChip({
  projectId,
  order,
}: {
  projectId: string;
  order: { id: string; status: string; po_number: string } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function prepare() {
    setBusy(true);
    const res = await fetch(`/api/projects/${projectId}/glass`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "prepare", line_items: [] }),
    });
    const data = (await res.json()) as { mailto?: string };
    setBusy(false);
    if (data.mailto) window.open(data.mailto);
    router.refresh();
  }

  async function advance(to?: string) {
    if (!order) return;
    setBusy(true);
    await fetch(`/api/projects/${projectId}/glass`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "advance", order_id: order.id, to }),
    });
    setBusy(false);
    router.refresh();
  }

  async function markNotNeeded() {
    setBusy(true);
    let orderId = order?.id;
    if (!orderId) {
      const res = await fetch(`/api/projects/${projectId}/glass`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "prepare", line_items: [] }),
      });
      const data = (await res.json()) as { order?: { id: string } };
      orderId = data.order?.id;
    }
    if (orderId) {
      await fetch(`/api/projects/${projectId}/glass`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "advance",
          order_id: orderId,
          to: "not_needed",
        }),
      });
    }
    setBusy(false);
    router.refresh();
  }

  if (order?.status === "not_needed") {
    return <Badge variant="secondary">Glass · not needed</Badge>;
  }

  if (!order) {
    return (
      <div className="inline-flex flex-wrap gap-1">
        <Button size="sm" variant="outline" disabled={busy} onClick={prepare}>
          Glass · prepare
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={markNotNeeded}>
          Not needed
        </Button>
      </div>
    );
  }

  const next = GLASS_NEXT[order.status];
  return (
    <div className="inline-flex flex-wrap gap-1 items-center">
      <button
        type="button"
        disabled={busy || !next}
        onClick={() => advance(next)}
        className="inline-flex"
        title="Tap to advance"
      >
        <Badge variant="secondary">
          Glass · {order.po_number} · {order.status.replace(/_/g, " ")}
        </Badge>
      </button>
      {order.status !== "received" && order.status !== "not_needed" ? (
        <Button size="sm" variant="ghost" disabled={busy} onClick={markNotNeeded}>
          Not needed
        </Button>
      ) : null}
    </div>
  );
}

export function HardwareChip({
  projectId,
  order,
}: {
  projectId: string;
  order: {
    id: string;
    status: string;
    partial?: boolean;
    order_number?: string | null;
    fulfillment?: string | null;
  } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [fulfillment, setFulfillment] = useState<"will_call" | "delivery">(
    "will_call",
  );

  async function advance(to?: string, extra: Record<string, string> = {}) {
    setBusy(true);
    await fetch(`/api/projects/${projectId}/hardware`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "advance",
        order_id: order?.id,
        to: to || (order ? HW_NEXT[order.status] || "in_cart" : "in_cart"),
        ...extra,
      }),
    });
    setBusy(false);
    setPrompt(false);
    router.refresh();
  }

  async function onTap() {
    if (!order || order.status === "not_started") {
      await advance("in_cart");
      return;
    }
    if (order.status === "in_cart") {
      setPrompt(true);
      return;
    }
    await advance();
  }

  async function markNotNeeded() {
    await advance("not_needed");
  }

  if (order?.status === "not_needed") {
    return <Badge variant="outline">Hardware · not needed</Badge>;
  }

  if (prompt) {
    return (
      <div className="flex flex-wrap gap-2 items-center rounded border px-2 py-1.5 bg-stone-50">
        <Input
          className="w-36"
          placeholder="CRL order #"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
        />
        <select
          className="rounded border px-2 py-1.5 text-sm"
          value={fulfillment}
          onChange={(e) =>
            setFulfillment(e.target.value as "will_call" | "delivery")
          }
        >
          <option value="will_call">Will-call</option>
          <option value="delivery">Delivery</option>
        </select>
        <Button
          size="sm"
          disabled={busy || !orderNumber.trim()}
          onClick={() =>
            advance("ordered", {
              order_number: orderNumber.trim(),
              fulfillment,
            })
          }
        >
          Ordered
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setPrompt(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  const label = order
    ? `Hardware · ${order.status.replace(/_/g, " ")}${order.partial ? " (partial)" : ""}${
        order.order_number ? ` · ${order.order_number}` : ""
      }${order.fulfillment ? ` · ${order.fulfillment.replace(/_/g, "-")}` : ""}`
    : "Hardware · not started";

  return (
    <div className="inline-flex flex-wrap gap-1 items-center">
      <button
        type="button"
        disabled={busy || order?.status === "received"}
        onClick={onTap}
        className="inline-flex"
      >
        <Badge variant="outline">{label}</Badge>
      </button>
      {!order || (order.status !== "received" && order.status !== "not_needed") ? (
        <Button size="sm" variant="ghost" disabled={busy} onClick={markNotNeeded}>
          Not needed
        </Button>
      ) : null}
    </div>
  );
}

export function UploadDoc({ projectId }: { projectId: string }) {
  const router = useRouter();
  return (
    <label className="text-sm text-stone-600 underline cursor-pointer">
      Upload
      <input
        type="file"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const fd = new FormData();
          fd.set("file", file);
          fd.set("project_id", projectId);
          await fetch("/api/documents", { method: "POST", body: fd });
          router.refresh();
        }}
      />
    </label>
  );
}

export function AccessEditor({
  projectId,
  lockbox,
  notes,
}: {
  projectId: string;
  lockbox: string | null;
  notes: string | null;
}) {
  const router = useRouter();
  const [code, setCode] = useState(lockbox || "");
  const [accessNotes, setAccessNotes] = useState(notes || "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        access_lockbox_code: code,
        access_notes: accessNotes,
      }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap gap-2 items-center">
        <label className="text-stone-500 w-16 shrink-0">Lockbox</label>
        <Input
          className="max-w-[10rem]"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code"
        />
      </div>
      <div className="flex flex-wrap gap-2 items-start">
        <label className="text-stone-500 w-16 shrink-0 pt-2">Notes</label>
        <Input
          className="flex-1 min-w-[12rem]"
          value={accessNotes}
          onChange={(e) => setAccessNotes(e.target.value)}
          placeholder="Gate code, dog, parking…"
        />
        <Button size="sm" variant="outline" disabled={busy} onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
}

export function AddProjectContact({
  projectId,
}: {
  projectId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("homeowner");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className="text-xs underline text-stone-600"
        onClick={() => setOpen(true)}
      >
        Add person
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 items-center mt-2">
      <Input
        className="w-32"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        className="w-32"
        placeholder="Phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <select
        className="rounded border px-2 py-1.5 text-sm"
        value={role}
        onChange={(e) => setRole(e.target.value)}
      >
        <option value="homeowner">Homeowner</option>
        <option value="contractor">Contractor</option>
        <option value="pm">PM</option>
        <option value="other">Other</option>
      </select>
      <Button
        size="sm"
        disabled={busy || !name.trim()}
        onClick={async () => {
          setBusy(true);
          await fetch(`/api/projects/${projectId}/contacts`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name, phone, role }),
          });
          setBusy(false);
          setOpen(false);
          setName("");
          setPhone("");
          router.refresh();
        }}
      >
        Add
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}
