"use client";

import { useEffect, useState, useTransition } from "react";

type Msg = { id: string; direction: string; body: string; created_at: string };

export function SmsThread({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  function load() {
    start(async () => {
      const res = await fetch(`/api/sms?project_id=${projectId}`);
      const data = (await res.json()) as {
        thread?: { id: string } | null;
        messages?: Msg[];
      };
      setThreadId(data.thread?.id || null);
      setMessages(data.messages || []);
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <section className="rounded border p-3 space-y-2">
      <h2 className="text-sm font-medium uppercase text-stone-500">SMS</h2>
      <ul className="space-y-1 max-h-40 overflow-auto text-sm">
        {messages.length === 0 ? (
          <li className="text-stone-500">No messages yet.</li>
        ) : (
          messages.map((m) => (
            <li key={m.id} className={m.direction === "outbound" ? "text-right" : ""}>
              <span className="inline-block rounded bg-stone-100 px-2 py-1">{m.body}</span>
            </li>
          ))
        )}
      </ul>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-2 py-1.5 text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Draft SMS…"
        />
        <button
          type="button"
          disabled={pending || !threadId || !text.trim()}
          className="rounded bg-stone-900 text-white px-3 py-1.5 text-sm disabled:opacity-50"
          onClick={() =>
            start(async () => {
              setErr("");
              const res = await fetch("/api/sms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ thread_id: threadId, body: text, confirm: true }),
              });
              const data = (await res.json()) as { error?: string };
              if (!res.ok) setErr(data.error || "Failed.");
              else {
                setText("");
                load();
              }
            })
          }
        >
          Send
        </button>
      </div>
      {err ? <p className="text-xs text-red-600">{err}</p> : null}
    </section>
  );
}
