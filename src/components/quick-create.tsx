// Persistent + quick-create sheet — customer, site address, optional note (≤30s).

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";

type Account = { id: string; name: string };

export function QuickCreate() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [newName, setNewName] = useState("");
  const [site, setSite] = useState("");
  const [note, setNote] = useState("");
  const [jobType, setJobType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/customers")
      .then((r) => r.json())
      .then((rows) => setAccounts(Array.isArray(rows) ? rows : []))
      .catch(() => setAccounts([]));
  }, [open]);

  async function ensureAccount(): Promise<string | null> {
    if (accountId) return accountId;
    if (!newName.trim()) return null;
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (!res.ok) return null;
    const row = (await res.json()) as { id: string };
    return row.id;
  }

  async function submit() {
    setBusy(true);
    setError("");
    const id = await ensureAccount();
    if (!id || !site.trim()) {
      setBusy(false);
      setError("Pick or add a customer, and enter the site address.");
      return;
    }
    const accountName =
      accounts.find((a) => a.id === id)?.name || newName.trim() || "Customer";
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        account_id: id,
        site_address: site.trim(),
        note: note || undefined,
        job_type: jobType || undefined,
        account_name: accountName,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Could not create.");
      return;
    }
    const project = (await res.json()) as { id: string };
    setOpen(false);
    setAccountId("");
    setNewName("");
    setSite("");
    setNote("");
    setJobType("");
    router.push(`/m/projects/${project.id}`);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            size="icon"
            className="fixed bottom-20 right-4 md:bottom-6 z-50 h-12 w-12 rounded-full shadow-lg"
            aria-label="Quick create"
          />
        }
      >
        +
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh]">
        <SheetHeader>
          <SheetTitle>New project</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 px-4">
          <div>
            <label className="text-xs text-stone-500">Customer</label>
            <select
              className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setNewName("");
              }}
            >
              <option value="">— pick or type new below —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {!accountId ? (
              <Input
                className="mt-2"
                placeholder="Or type a new customer name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            ) : null}
          </div>
          <div>
            <label className="text-xs text-stone-500">Site address</label>
            <Input
              className="mt-1"
              placeholder="42 Oak St"
              value={site}
              onChange={(e) => setSite(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-stone-500">Note (optional)</label>
            <Input
              className="mt-1"
              placeholder="Gate code, dog, etc."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-stone-500">Job type (optional)</label>
            <Input
              className="mt-1"
              placeholder="Shower, mirror…"
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <SheetFooter>
          <Button disabled={busy} onClick={submit}>
            Create
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
