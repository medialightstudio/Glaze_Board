"use client";

// Complete visit — photos, punch list, signature or skip reason.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function CompleteVisit({
  visitId,
  projectId,
  type,
}: {
  visitId: string;
  projectId: string;
  type: string;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [name, setName] = useState("");
  const [punch, setPunch] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [skip, setSkip] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function pointer(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (e.type === "pointerdown") {
      setDrawing(true);
      ctx.beginPath();
      ctx.moveTo(x, y);
      canvas.setPointerCapture(e.pointerId);
    } else if (e.type === "pointermove" && drawing) {
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#1c1917";
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (e.type === "pointerup") {
      setDrawing(false);
    }
  }

  function clearSig() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }

  function submit() {
    setError("");
    start(async () => {
      let signatureDataUrl: string | null = null;
      if (!skip) {
        if (!name.trim()) {
          setError("Homeowner name is required.");
          return;
        }
        signatureDataUrl = canvasRef.current?.toDataURL("image/png") || null;
        if (!signatureDataUrl) {
          setError("Signature is required, or skip with a reason.");
          return;
        }
      } else if (!skipReason.trim()) {
        setError("A reason is required to skip sign-off.");
        return;
      }

      const res = await fetch(`/api/field/visits/${visitId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          type,
          homeowner_name: name,
          punch_list: punch
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          skip,
          skip_reason: skipReason,
          signature_data_url: signatureDataUrl,
        }),
      });
      const data = await res.json() as any;
      if (!res.ok) {
        setError(data.error || "Could not complete.");
        return;
      }
      router.refresh();
      router.push("/f");
    });
  }

  return (
    <section className="space-y-3 border-t pt-4">
      <h2 className="text-sm font-medium uppercase text-stone-500">Complete</h2>
      <label className="block text-sm">
        Punch list (optional, one per line)
        <textarea
          className="mt-1 w-full rounded border px-3 py-2 text-base"
          rows={3}
          value={punch}
          onChange={(e) => setPunch(e.target.value)}
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
        Skip homeowner sign-off
      </label>

      {skip ? (
        <label className="block text-sm">
          Reason
          <input
            className="mt-1 w-full rounded border px-3 py-2 text-base"
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
          />
        </label>
      ) : (
        <>
          <label className="block text-sm">
            Homeowner name
            <input
              className="mt-1 w-full rounded border px-3 py-2 text-base"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Signature</span>
              <button type="button" className="underline" onClick={clearSig}>
                Clear
              </button>
            </div>
            <canvas
              ref={canvasRef}
              width={340}
              height={140}
              className="w-full touch-none rounded border bg-white"
              onPointerDown={pointer}
              onPointerMove={pointer}
              onPointerUp={pointer}
            />
          </div>
        </>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="w-full rounded-lg bg-stone-900 text-white py-3 text-base font-medium disabled:opacity-50"
      >
        {pending ? "Saving…" : "Mark complete"}
      </button>
    </section>
  );
}
