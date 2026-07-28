// Management navigation — Operations wing, Customers & Sales, Settings.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ops = [
  { href: "/m", label: "Today", short: "Today" },
  { href: "/m/pipeline", label: "Pipeline", short: "Pipe" },
  { href: "/m/dispatch", label: "Dispatch", short: "Dispatch" },
  { href: "/m/service", label: "Service", short: "Service" },
  { href: "/m/review", label: "Review Queue", short: "Review" },
];

const sales = [
  { href: "/m/customers", label: "Customers" },
  { href: "/m/quotes", label: "Quotes" },
  { href: "/m/billing", label: "Billing" },
];

const settings = [
  { href: "/m/reports", label: "Reports" },
  { href: "/m/settings", label: "Settings" },
];

function useActive(href: string) {
  const pathname = usePathname();
  return href === "/m"
    ? pathname === "/m"
    : pathname === href || pathname.startsWith(href + "/");
}

function NavLink({
  href,
  label,
  badge,
}: {
  href: string;
  label: string;
  badge?: number;
}) {
  const active = useActive(href);
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between gap-2 rounded px-3 py-2 text-sm",
        active ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100",
      )}
    >
      <span>{label}</span>
      {badge && badge > 0 ? (
        <span
          className={cn(
            "min-w-5 rounded-full px-1.5 text-center text-[10px] font-semibold",
            active ? "bg-white text-stone-900" : "bg-stone-900 text-white",
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

export function MSidebar({ reviewCount = 0 }: { reviewCount?: number }) {
  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col gap-4 border-r bg-stone-50 p-3 min-h-[calc(100vh-49px)]">
      <div>
        <div className="px-3 pb-1 text-xs font-medium uppercase text-stone-500">
          Operations
        </div>
        {ops.map((i) => (
          <NavLink
            key={i.href}
            href={i.href}
            label={i.label}
            badge={i.href === "/m/review" ? reviewCount : undefined}
          />
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

export function MMobileTabs({ reviewCount = 0 }: { reviewCount?: number }) {
  const pathname = usePathname();
  const more = [...sales, ...settings];
  const moreActive = more.some(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/"),
  );

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 border-t bg-white z-40">
      <div className="grid grid-cols-6 text-[11px]">
        {ops.map((i) => {
          const active =
            i.href === "/m"
              ? pathname === "/m"
              : pathname === i.href || pathname.startsWith(i.href + "/");
          return (
            <Link
              key={i.href}
              href={i.href}
              className={cn(
                "relative py-2 text-center",
                active ? "font-semibold text-stone-900" : "text-stone-500",
              )}
            >
              {i.short}
              {i.href === "/m/review" && reviewCount > 0 ? (
                <span className="absolute top-1 right-1/2 translate-x-3 min-w-4 h-4 rounded-full bg-stone-900 text-white text-[9px] leading-4 px-0.5">
                  {reviewCount > 9 ? "9+" : reviewCount}
                </span>
              ) : null}
            </Link>
          );
        })}
        <details className="relative">
          <summary
            className={cn(
              "py-2 text-center list-none cursor-pointer",
              moreActive ? "font-semibold text-stone-900" : "text-stone-500",
            )}
          >
            More
          </summary>
          <div className="absolute bottom-full right-0 mb-1 w-40 rounded border bg-white shadow p-1">
            {more.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className="block px-2 py-1.5 text-sm"
              >
                {i.label}
              </Link>
            ))}
          </div>
        </details>
      </div>
    </nav>
  );
}
