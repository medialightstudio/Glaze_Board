// Drop a map pin by hand when geocoding missed the address.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DropPin({
  projectId,
  lat,
  lng,
}: {
  projectId: string;
  lat?: number | null;
  lng?: number | null;
}) {
  const router = useRouter();
  const [la, setLa] = useState(lat != null ? String(lat) : "");
  const [ln, setLn] = useState(lng != null ? String(lng) : "");
  const [msg, setMsg] = useState("");

  async function save() {
    setMsg("");
    const res = await fetch(`/api/projects/${projectId}/pin`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lat: Number(la), lng: Number(ln) }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMsg(data.error || "Could not save pin.");
      return;
    }
    setMsg("Pin saved.");
    router.refresh();
  }

  return (
    <div className="rounded border p-3 space-y-2 text-sm">
      <div className="font-medium">Map pin</div>
      {lat != null && lng != null ? (
        <p className="text-stone-600">
          Current: {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
      ) : (
        <p className="text-stone-600">No pin yet — geocoding may have missed this address.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Latitude" value={la} onChange={(e) => setLa(e.target.value)} className="w-36" />
        <Input placeholder="Longitude" value={ln} onChange={(e) => setLn(e.target.value)} className="w-36" />
        <Button type="button" size="sm" onClick={save}>
          Save pin
        </Button>
      </div>
      {msg ? <p className="text-xs text-stone-500">{msg}</p> : null}
    </div>
  );
}
