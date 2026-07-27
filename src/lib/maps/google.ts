// DEC-16 upgrade slot — Google Maps implementation intentionally empty.

import type { LatLng } from "./types";

/** Stub — switch the adapter to this file when upgrading to Google (DEC-16). */
export async function geocodeGoogle(_address: string): Promise<LatLng | null> {
  return null;
}
