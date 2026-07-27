"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export function BookVisitForm({
  users,
  projects,
}: {
  users: { id: string; name: string }[];
  projects: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("measure");
  const [projectId, setProjectId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    await fetch("/api/visits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type,
        project_id: projectId || undefined,
        starts_at: new Date(startsAt).toISOString(),
        assignees: assignee ? [assignee] : [],
      }),
    });
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Book visit</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book visit</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <select
            className="w-full rounded-lg border px-2 py-1.5 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="measure">Measure</option>
            <option value="install">Install</option>
            <option value="service">Service</option>
          </select>
          <select
            className="w-full rounded-lg border px-2 py-1.5 text-sm"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <Input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
          <select
            className="w-full rounded-lg border px-2 py-1.5 text-sm"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          >
            <option value="">Assignee</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button disabled={busy || !startsAt} onClick={submit}>
            Book
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
