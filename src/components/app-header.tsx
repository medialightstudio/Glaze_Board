// Management header — company name, debounced search dropdown, user menu.

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SearchResults = {
  projects: { id: string; title: string; site_address?: string }[];
  contacts: { id: string; name: string; phone?: string; account_id?: string }[];
  accounts: { id: string; name: string }[];
  glass: { id: string; po_number: string; project_id: string }[];
  hardware: { id: string; order_number?: string; project_id: string }[];
  tickets: { id: string; issue: string; address?: string; urgency?: string }[];
  visits: {
    id: string;
    type: string;
    title: string;
    address?: string;
    project_id?: string;
    ticket_id?: string;
  }[];
};

const empty: SearchResults = {
  projects: [],
  contacts: [],
  accounts: [],
  glass: [],
  hardware: [],
  tickets: [],
  visits: [],
};

export function AppHeader({
  companyName,
  userName,
  unreadCount = 0,
}: {
  companyName: string;
  userName: string;
  unreadCount?: number;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults>(empty);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(empty);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json() as Promise<SearchResults>)
        .then((data) => {
          setResults({ ...empty, ...data });
          setOpen(true);
        })
        .catch(() => setResults(empty));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function logout() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  const groups: { title: string; items: { key: string; href: string; label: string }[] }[] = [
    {
      title: "Projects",
      items: (results.projects || []).map((p) => ({
        key: p.id,
        href: `/m/projects/${p.id}`,
        label: p.title,
      })),
    },
    {
      title: "Visits",
      items: (results.visits || []).map((v) => ({
        key: v.id,
        href: v.project_id
          ? `/m/projects/${v.project_id}`
          : v.ticket_id
            ? `/m/service/${v.ticket_id}`
            : `/f/jobs/${v.id}`,
        label: `${v.type} · ${v.title}`,
      })),
    },
    {
      title: "Tickets",
      items: (results.tickets || []).map((t) => ({
        key: t.id,
        href: `/m/service/${t.id}`,
        label: t.urgency === "urgent" ? `⚠ ${t.issue}` : t.issue,
      })),
    },
    {
      title: "Customers",
      items: (results.accounts || []).map((a) => ({
        key: a.id,
        href: `/m/customers/${a.id}`,
        label: a.name,
      })),
    },
    {
      title: "Contacts",
      items: (results.contacts || []).map((c) => ({
        key: c.id,
        href: c.account_id ? `/m/customers/${c.account_id}` : "/m/customers",
        label: `${c.name}${c.phone ? ` · ${c.phone}` : ""}`,
      })),
    },
    {
      title: "Glass POs",
      items: (results.glass || []).map((g) => ({
        key: g.id,
        href: `/m/projects/${g.project_id}`,
        label: g.po_number,
      })),
    },
    {
      title: "Hardware",
      items: (results.hardware || []).map((h) => ({
        key: h.id,
        href: `/m/projects/${h.project_id}`,
        label: h.order_number || h.id.slice(0, 8),
      })),
    },
  ];
  const has = groups.some((g) => g.items.length > 0);

  return (
    <header className="flex items-center gap-3 border-b px-3 py-2 bg-white">
      <div className="font-semibold text-sm shrink-0">{companyName}</div>
      <div className="relative flex-1 max-w-md" ref={boxRef}>
        <Input
          placeholder="Search projects, visits, tickets, POs…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q.trim().length >= 2 && setOpen(true)}
        />
        {open && q.trim().length >= 2 ? (
          <div className="absolute z-50 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-80 overflow-auto text-sm">
            {!has ? (
              <p className="px-3 py-2 text-stone-500">No matches</p>
            ) : (
              groups.map((g) =>
                g.items.length === 0 ? null : (
                  <div key={g.title} className="py-1">
                    <div className="px-3 py-1 text-[10px] uppercase text-stone-400">
                      {g.title}
                    </div>
                    {g.items.map((i) => (
                      <Link
                        key={i.key}
                        href={i.href}
                        onClick={() => setOpen(false)}
                        className="block px-3 py-1.5 hover:bg-stone-50 truncate"
                      >
                        {i.label}
                      </Link>
                    ))}
                  </div>
                ),
              )
            )}
          </div>
        ) : null}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/m/notifications"
          aria-label="Notifications"
          className="relative"
        >
          <Bell className="h-5 w-5 text-stone-600" />
          {unreadCount > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-stone-900 text-white text-[9px] leading-4 text-center px-0.5">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Link>
        <span className="text-sm text-stone-600 hidden sm:inline">{userName}</span>
        <Button variant="outline" size="sm" onClick={logout}>
          Log out
        </Button>
      </div>
    </header>
  );
}
