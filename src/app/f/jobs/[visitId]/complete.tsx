"use client";

// Complete visit — photos, punch list, ink-checked signature or skip reason.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function canvasHasInk(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 10) return true;
  }
  return false;
}

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
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function pointer(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    if (e.type === "pointerdown") {
      setDrawing(true);
      ctx.beginPath();
      ctx.moveTo(x, y);
      canvas.setPointerCapture(e.pointerId);
    } else if (e.type === "pointermove" && drawing) {
      ctx.lineWidth = 2.5;
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
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }

  function submit() {
    setError("");
    start(async () => {
      if (type === "install" && photos.length === 0 && !skip) {
        setError("Add at least one photo for an install.");
        return;
      }
      let signatureDataUrl: string | null = null;
      if (!skip) {
        if (!name.trim()) {
          setError("Homeowner name is required.");
          return;
        }
        const canvas = canvasRef.current;
        if (!canvas || !canvasHasInk(canvas)) {
          setError("Signature is required, or skip with a reason.");
          return;
        }
        signatureDataUrl = canvas.toDataURL("image/png");
      } else if (!skipReason.trim()) {
        setError("A reason is required to skip sign-off.");
        return;
      }

      const form = new FormData();
      form.set("project_id", projectId);
      form.set("type", type);
      form.set("homeowner_name", name);
      form.set("skip", skip ? "1" : "0");
      form.set("skip_reason", skipReason);
      form.set(
        "punch_list",
        JSON.stringify(
          punch
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      );
      if (signatureDataUrl) form.set("signature_data_url", signatureDataUrl);
      for (const f of photos) form.append("photos", f);

      const res = await fetch(`/api/field/visits/${visitId}/complete`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { error?: string };
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
        Photos {type === "install" ? "(required)" : "(optional)"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="mt-1 block w-full text-sm"
          onChange={(e) => setPhotos(Array.from(e.target.files || []))}
        />
      </label>
      {photos.length ? (
        <p className="text-xs text-stone-500">{photos.length} photo(s) selected</p>
      ) : null}

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
