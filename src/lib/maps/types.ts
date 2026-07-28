// Shared map types for the adapter.

export type LatLng = { lat: number; lng: number };

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  color: string;
  urgent?: boolean;
  label: string;
  href?: string;
};
