// Money helpers — store whole cents; format only for display. DEC-30

export function formatCents(cents: number): string {
  const n = Number.isFinite(cents) ? cents : 0;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(Math.round(n));
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${sign}$${dollars.toLocaleString("en-US")}.${String(rem).padStart(2, "0")}`;
}

export function dollarsToCents(dollars: number | string): number {
  const n = typeof dollars === "string" ? Number(dollars) : dollars;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function marginCents(price: number, glass: number, hardware: number): number {
  return Math.round(price || 0) - Math.round(glass || 0) - Math.round(hardware || 0);
}
