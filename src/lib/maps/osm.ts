// OpenStreetMap + Nominatim — active map implementation. 1 req/sec queue.

import type { LatLng } from "./types";

const UA = "GlazeBoard/0.1 (glass shop ops; contact: support@glazeboard.com)";

let lastNominatimAt = 0;
const queue: Array<() => void> = [];
let pumping = false;

function pump() {
  if (pumping) return;
  pumping = true;
  const tick = async () => {
    if (queue.length === 0) {
      pumping = false;
      return;
    }
    const wait = Math.max(0, 1000 - (Date.now() - lastNominatimAt));
    await new Promise((r) => setTimeout(r, wait));
    const job = queue.shift();
    lastNominatimAt = Date.now();
    job?.();
    tick();
  };
  tick();
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    queue.push(() => {
      fn().then(resolve, reject);
    });
    pump();
  });
}

/** Geocode an address via Nominatim. Returns null on failure — never throws to callers. */
export async function geocodeOsm(address: string): Promise<LatLng | null> {
  const q = (address || "").trim();
  if (!q) return null;
  try {
    return await enqueue(async () => {
      const url =
        "https://nominatim.openstreetmap.org/search?" +
        new URLSearchParams({ q, format: "json", limit: "1" });
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { lat: string; lon: string }[];
      if (!data[0]) return null;
      return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
    });
  } catch {
    return null;
  }
}

export const osmTileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const osmAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
