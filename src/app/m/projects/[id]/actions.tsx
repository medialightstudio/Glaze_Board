"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function NextActionButton({
  projectId,
  label,
  to,
}: {
  projectId: string;
  label: string;
  to: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [ask, setAsk] = useState(false);

  async function go(extra: Record<string, string> = {}) {
    setBusy(true);
    await fetch(`/api/projects/${projectId}/transition`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to, note: note || undefined, ...extra }),
    });
    setBusy(false);
    setAsk(false);
    router.refresh();
  }

  if (to === "approved" && !ask) {
    return (
      <Button onClick={() => setAsk(true)} disabled={busy}>
        {label}
      </Button>
    );
  }
  if (to === "approved" && ask) {
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
    <Button disabled={busy} onClick={() => go()}>
      {label}
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

  if (!order) {
    return (
      <Button size="sm" variant="outline" disabled={busy} onClick={prepare}>
        Glass · prepare
      </Button>
    );
  }
  const next = GLASS_NEXT[order.status];
  return (
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
  );
}

export function HardwareChip({
  projectId,
  order,
}: {
  projectId: string;
  order: { id: string; status: string; partial?: boolean } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function advance() {
    setBusy(true);
    await fetch(`/api/projects/${projectId}/hardware`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "advance",
        order_id: order?.id,
        to: order ? HW_NEXT[order.status] || "in_cart" : "in_cart",
      }),
    });
    setBusy(false);
    router.refresh();
  }

  const label = order
    ? `Hardware · ${order.status.replace(/_/g, " ")}${order.partial ? " (partial)" : ""}`
    : "Hardware · not started";

  return (
    <button type="button" disabled={busy} onClick={advance} className="inline-flex">
      <Badge variant="outline">{label}</Badge>
    </button>
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
