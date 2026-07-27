// Shared management page chrome — one padding/max-width/title pattern.

import { cn } from "@/lib/utils";

export function OpsPage({
  title,
  purpose,
  actions,
  children,
  className,
  wide,
}: {
  title: string;
  purpose?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "p-4 space-y-5",
        wide ? "max-w-5xl" : "max-w-3xl",
        className,
      )}
    >
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {purpose ? (
            <p className="text-sm text-stone-500 mt-0.5">{purpose}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

export function OpsSection({
  title,
  children,
  count,
}: {
  title: string;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <section>
      <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500 mb-2">
        {title}
        {typeof count === "number" ? (
          <span className="ml-1.5 text-stone-400 normal-case tracking-normal">
            {count}
          </span>
        ) : null}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function OpsEmpty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-stone-500">{children}</p>;
}
