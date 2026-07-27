// Leaflet map — client only. Pins colored by task type; urgent = red ring.

"use client";

import { useEffect, useId, useRef } from "react";
import type { MapPin } from "@/lib/maps";

export function MapView({ pins }: { pins: MapPin[] }) {
  const id = useId().replace(/:/g, "");
  const mapId = `glaze-map-${id}`;
  const pinsKey = JSON.stringify(pins.map((p) => [p.id, p.lat, p.lng, p.color, p.urgent]));
  const pinsRef = useRef(pins);
  pinsRef.current = pins;

  useEffect(() => {
    let map: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      const leaflet = await import("leaflet");
      const L = (leaflet as { default?: typeof leaflet }).default || leaflet;
      await import("leaflet/dist/leaflet.css");
      if (cancelled) return;

      const el = document.getElementById(mapId);
      if (!el) return;

      const current = pinsRef.current;
      const center: [number, number] =
        current.length > 0
          ? [current[0].lat, current[0].lng]
          : [38.5816, -121.4944];

      map = L.map(el).setView(center, current.length ? 11 : 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      for (const p of current) {
        const html = `<div style="width:16px;height:16px;border-radius:999px;background:${p.color};border:3px solid ${p.urgent ? "#DC2626" : "white"};box-shadow:0 0 0 1px rgba(0,0,0,.25)"></div>`;
        const icon = L.divIcon({
          className: "",
          html,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        const m = L.marker([p.lat, p.lng], { icon }).addTo(map);
        m.bindPopup(
          `<div style="font:12px system-ui">${p.label}${
            p.href ? `<br/><a href="${p.href}">Open</a>` : ""
          }</div>`,
        );
      }
      if (current.length > 1 && map) {
        (map as any).fitBounds(
          L.latLngBounds(current.map((p) => [p.lat, p.lng] as [number, number])),
          { padding: [24, 24] },
        );
      }
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
    };
  }, [mapId, pinsKey]);

  return <div id={mapId} className="h-72 w-full rounded border z-0 bg-stone-100" />;
}
