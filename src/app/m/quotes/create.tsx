"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CreateQuoteButton({
  projects,
}: {
  projects: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!projectId) return;
    setBusy(true);
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    const data = (await res.json()) as { id?: string };
    setBusy(false);
    if (res.ok && data.id) {
      setOpen(false);
      router.push(`/m/quotes/${data.id}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>New quote</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New quote</DialogTitle>
        </DialogHeader>
        <select
          className="w-full rounded-lg border px-2 py-1.5 text-sm"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">Pick a project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <DialogFooter>
          <Button disabled={busy || !projectId} onClick={create}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
