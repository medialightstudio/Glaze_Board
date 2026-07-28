// Persistent + quick-create sheet — typeahead customer, site, optional note (≤30s).

"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [customerQuery, setCustomerQuery] = useState("");
  const [accountId, setAccountId] = useState("");
  const [site, setSite] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/customers")
      .then((r) => r.json())
      .then((rows) => setAccounts(Array.isArray(rows) ? rows : []))
      .catch(() => setAccounts([]));
  }, [open]);

  const matches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return accounts.slice(0, 8);
    return accounts
      .filter((a) => a.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [accounts, customerQuery]);

  const exact = accounts.find(
    (a) => a.name.toLowerCase() === customerQuery.trim().toLowerCase(),
  );
  const selected = accounts.find((a) => a.id === accountId);

  async function ensureAccount(): Promise<{ id: string; name: string } | null> {
    if (accountId && selected) return selected;
    const name = customerQuery.trim();
    if (!name) return null;
    if (exact) return exact;
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    const row = (await res.json()) as { id: string; name: string };
    return row;
  }

  async function submit() {
    setBusy(true);
    setError("");
    const account = await ensureAccount();
    if (!account || !site.trim()) {
      setBusy(false);
      setError("Type a customer (pick or add) and the site address.");
      return;
    }
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        account_id: account.id,
        site_address: site.trim(),
        note: note || undefined,
        account_name: account.name,
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
    setCustomerQuery("");
    setSite("");
    setNote("");
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
            <Input
              className="mt-1"
              placeholder="Type to pick or add…"
              value={selected && !customerQuery ? selected.name : customerQuery}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                setAccountId("");
              }}
              autoComplete="off"
            />
            {customerQuery.trim() && !accountId ? (
              <ul className="mt-1 rounded border bg-white max-h-40 overflow-auto text-sm">
                {matches.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className="w-full text-left px-2 py-1.5 hover:bg-stone-50"
                      onClick={() => {
                        setAccountId(a.id);
                        setCustomerQuery(a.name);
                      }}
                    >
                      {a.name}
                    </button>
                  </li>
                ))}
                {!exact ? (
                  <li>
                    <button
                      type="button"
                      className="w-full text-left px-2 py-1.5 hover:bg-stone-50 text-stone-700"
                      onClick={() => {
                        setAccountId("");
                        setCustomerQuery(customerQuery.trim());
                      }}
                    >
                      Add “{customerQuery.trim()}”
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : null}
            {accountId || (customerQuery.trim() && !exact) ? (
              <p className="mt-1 text-xs text-stone-500">
                {accountId
                  ? `Using ${selected?.name}`
                  : `Will create customer “${customerQuery.trim()}”`}
              </p>
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
