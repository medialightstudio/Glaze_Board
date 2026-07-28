"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function CrlBridgeToggle({
  tos,
  enabled,
}: {
  tos: boolean;
  enabled: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function save(next: { crl_tos_accepted?: boolean; crl_bridge_enabled?: boolean }) {
    start(async () => {
      await fetch("/api/settings/crl-bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      router.refresh();
    });
  }

  return (
    <div className="rounded border px-3 py-2 space-y-2 text-sm">
      <div className="font-medium">CRL Bridge (D4)</div>
      <label className="flex items-center justify-between gap-2">
        <span>I accept CRL ToS risk for automated browsing</span>
        <input
          type="checkbox"
          disabled={pending}
          checked={tos}
          onChange={(e) => save({ crl_tos_accepted: e.target.checked })}
        />
      </label>
      <label className="flex items-center justify-between gap-2">
        <span>Enable Bridge L1</span>
        <input
          type="checkbox"
          disabled={pending || !tos}
          checked={enabled}
          onChange={(e) => save({ crl_bridge_enabled: e.target.checked })}
        />
      </label>
      <p className="text-xs text-stone-500">
        L1 stays off until ToS is checked. Failures degrade to the L0 copy panel.
      </p>
    </div>
  );
}
