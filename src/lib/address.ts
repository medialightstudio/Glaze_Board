// Address normalize + match helpers — first-class matching key.

export type NormalizedAddress = {
  address_norm: string;
  address_unit: string | null;
  zip: string | null;
};

const STREET: Record<string, string> = {
  street: "st",
  avenue: "ave",
  drive: "dr",
  road: "rd",
  boulevard: "blvd",
  lane: "ln",
  court: "ct",
};

const COMPASS: Record<string, string> = {
  north: "n",
  south: "s",
  east: "e",
  west: "w",
};

const UNIT_RE = /(?:\b(?:suite|ste|unit|apt|apartment)\b|#)\s*([a-z0-9-]+)\b/i;

export function normalizeAddress(raw: string, zipIn?: string | null): NormalizedAddress {
  let s = (raw || "").toLowerCase().trim();
  s = s.replace(/[.,]/g, " ");
  s = s.replace(/\s+/g, " ");

  let address_unit: string | null = null;
  const unitMatch = s.match(UNIT_RE);
  if (unitMatch) {
    address_unit = unitMatch[1].toLowerCase();
    s = s.replace(UNIT_RE, " ").replace(/\s+/g, " ").trim();
  }

  let zip: string | null = zipIn?.trim() || null;
  const zipInStreet = s.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zipInStreet) {
    zip = zip || zipInStreet[1];
    s = s.replace(zipInStreet[0], " ").replace(/\s+/g, " ").trim();
  }

  const parts = s.split(" ").filter(Boolean).map((w) => {
    if (STREET[w]) return STREET[w];
    if (COMPASS[w]) return COMPASS[w];
    return w;
  });

  return { address_norm: parts.join(" "), address_unit, zip };
}

export function addressesMatch(a: NormalizedAddress, b: NormalizedAddress): boolean {
  if (!a.address_norm || !b.address_norm) return false;
  if (a.address_norm !== b.address_norm) return false;
  const unitA = a.address_unit || "";
  const unitB = b.address_unit || "";
  if (unitA !== unitB) return false;
  if (a.zip && b.zip && a.zip !== b.zip) return false;
  return true;
}
