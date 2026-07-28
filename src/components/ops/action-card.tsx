// One card, one action — Today and list boards.

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { TaskColorKey } from "@/lib/colors";
import { taskColors } from "@/lib/colors";

const stripeFor: Partial<Record<string, string>> = {
  measure: taskColors.measure,
  install: taskColors.install,
  service: taskColors.service,
  urgent: taskColors.urgentRing,
};

export function ActionCard({
  href,
  label,
  meta,
  action,
  stripe,
  urgent,
}: {
  href: string;
  label: string;
  meta?: string;
  action: string;
  stripe?: TaskColorKey | "measure" | "install" | "service" | "urgent" | string;
  urgent?: boolean;
}) {
  const color =
    (stripe && stripeFor[stripe]) ||
    (typeof stripe === "string" && stripe.startsWith("#") ? stripe : undefined);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-stretch gap-0 rounded border bg-white hover:bg-stone-50 overflow-hidden",
        urgent && "ring-2 ring-red-600 ring-offset-1",
      )}
    >
      {color ? (
        <span
          className="w-1.5 shrink-0"
          style={{ background: color }}
          aria-hidden
        />
      ) : null}
      <div className="flex flex-1 items-center justify-between gap-3 px-3 py-2 min-w-0">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          {meta ? (
            <div className="text-xs text-stone-500 truncate">{meta}</div>
          ) : null}
        </div>
        <span className="text-xs font-medium text-stone-600 shrink-0">
          {action}
        </span>
      </div>
    </Link>
  );
}
