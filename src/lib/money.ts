// Money helpers — store whole cents as integers; format only for display. DEC-30

/** Convert a display dollar amount (e.g. 12.34) to integer cents. */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Convert integer cents to a plain dollar number (e.g. 1234 → 12.34). */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/** Format integer cents as a USD display string (e.g. 1234 → "$12.34"). */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(centsToDollars(cents));
}
