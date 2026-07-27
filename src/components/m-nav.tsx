// Management navigation — Operations wing, Customers & Sales, Settings.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ops = [
  { href: "/m", label: "Today" },
  { href: "/m/pipeline", label: "Pipeline" },
  { href: "/m/dispatch", label: "Dispatch" },
  { href: "/m/service", label: "Service" },
  { href: "/m/review", label: "Review Queue" },
];

const sales = [
  { href: "/m/customers", label: "Customers" },
  { href: "/m/quotes", label: "Quotes" },
  { href: "/m/billing", label: "Billing" },
];

const settings = [{ href: "/m/settings", label: "Settings" }];

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active =
    href === "/m" ? pathname === "/m" : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "block rounded px-3 py-2 text-sm",
        active ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100",
      )}
    >
      {label}
    </Link>
  );
}

export function MSidebar() {
  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col gap-4 border-r bg-stone-50 p-3 min-h-[calc(100vh-49px)]">
      <div>
        <div className="px-3 pb-1 text-xs font-medium uppercase text-stone-500">
          Operations
        </div>
        {ops.map((i) => (
          <NavLink key={i.href} {...i} />
        ))}
      </div>
      <div>
        <div className="px-3 pb-1 text-xs font-medium uppercase text-stone-500">
          Customers & Sales
        </div>
        {sales.map((i) => (
          <NavLink key={i.href} {...i} />
        ))}
      </div>
      <div className="mt-auto">
        {settings.map((i) => (
          <NavLink key={i.href} {...i} />
        ))}
      </div>
    </aside>
  );
}

export function MMobileTabs() {
  const more = [...sales, ...settings];
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 border-t bg-white z-40">
      <div className="grid grid-cols-6 text-[11px]">
        {ops.map((i) => (
          <Link key={i.href} href={i.href} className="py-2 text-center">
            {i.label.split(" ")[0]}
          </Link>
        ))}
        <details className="relative">
          <summary className="py-2 text-center list-none cursor-pointer">More</summary>
          <div className="absolute bottom-full right-0 mb-1 w-40 rounded border bg-white shadow p-1">
            {more.map((i) => (
              <Link key={i.href} href={i.href} className="block px-2 py-1.5 text-sm">
                {i.label}
              </Link>
            ))}
          </div>
        </details>
      </div>
    </nav>
  );
}
