// Registers the push-only service worker and links the web manifest.

"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore — preview/dev may block SW */
    });
  }, []);
  return null;
}
