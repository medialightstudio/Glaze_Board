// Shared book-visit sheet — Project next-action, Today, and Dispatch all use this.

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

type UserOpt = { id: string; name: string };
type ProjectOpt = { id: string; title: string };

export function BookVisitSheet({
  users,
  projects,
  projectId: fixedProjectId,
  defaultType = "measure",
  triggerLabel = "Book visit",
  open: controlledOpen,
  onOpenChange,
  hideTrigger,
}: {
  users: UserOpt[];
  projects?: ProjectOpt[];
  projectId?: string;
  defaultType?: "measure" | "install" | "service";
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [type, setType] = useState(defaultType);
  const [projectId, setProjectId] = useState(fixedProjectId || "");
  const [startsAt, setStartsAt] = useState("");
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/visits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type,
        project_id: (fixedProjectId || projectId) || undefined,
        starts_at: new Date(startsAt).toISOString(),
        assignees: assignee ? [assignee] : [],
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Could not book visit.");
      return;
    }
    setOpen(false);
    setStartsAt("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger ? (
        <DialogTrigger render={<Button size="sm" />}>{triggerLabel}</DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{triggerLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <select
            className="w-full rounded-lg border px-2 py-1.5 text-sm"
            value={type}
            onChange={(e) =>
              setType(e.target.value as "measure" | "install" | "service")
            }
          >
            <option value="measure">Measure</option>
            <option value="install">Install</option>
            <option value="service">Service</option>
          </select>
          {!fixedProjectId ? (
            <select
              className="w-full rounded-lg border px-2 py-1.5 text-sm"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">No project</option>
              {(projects || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          ) : null}
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
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
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
