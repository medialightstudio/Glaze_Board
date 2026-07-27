// Map adapter — OSM active; Google is the DEC-16 upgrade slot.

export type { LatLng, MapPin } from "./types";
export { geocodeOsm as geocode, osmTileUrl, osmAttribution } from "./osm";
export { geocodeGoogle } from "./google";
