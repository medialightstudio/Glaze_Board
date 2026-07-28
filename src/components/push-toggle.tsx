// Settings control — enable browser push for gate flips and urgent tickets.

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function PushToggle({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setEnabled(initiallyEnabled), [initiallyEnabled]);

  async function enable() {
    setBusy(true);
    setMsg("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setMsg("This browser does not support push.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const vapid = (await fetch("/api/push/vapid").then((r) => r.json())) as {
        publicKey?: string;
      };
      if (!vapid.publicKey) {
        setMsg("Push is not configured on the server.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
      });
      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          subscription: {
            endpoint: json.endpoint,
            keys: json.keys,
          },
        }),
      });
      if (!res.ok) {
        setMsg("Could not save subscription.");
        return;
      }
      setEnabled(true);
      setMsg("Push on — you'll get gate and urgent alerts.");
    } catch {
      setMsg("Could not enable push (permission denied or unsupported).");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg("");
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    setEnabled(false);
    setMsg("Push off.");
    setBusy(false);
  }

  return (
    <div className="rounded border p-3 space-y-2 text-sm">
      <div className="font-medium">Push notifications</div>
      <p className="text-stone-600">
        Gate flips and urgent tickets. Works best after installing the app.
      </p>
      {enabled ? (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={disable}>
          Turn off
        </Button>
      ) : (
        <Button type="button" size="sm" disabled={busy} onClick={enable}>
          Turn on
        </Button>
      )}
      {msg ? <p className="text-xs text-stone-500">{msg}</p> : null}
    </div>
  );
}
