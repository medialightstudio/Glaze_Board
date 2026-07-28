"use client";

import { useState, useTransition } from "react";

export function TelegramBind({
  bindCode,
  bound,
  chatId,
}: {
  bindCode: string | null;
  bound: boolean;
  chatId: string | null;
}) {
  const [code, setCode] = useState(bindCode);
  const [pending, start] = useTransition();

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium uppercase text-stone-500">Telegram</h2>
      {bound ? (
        <p className="text-sm text-stone-600">Bound to chat {chatId}.</p>
      ) : (
        <>
          <p className="text-sm text-stone-600">
            Generate a code, then send it to the bot to bind this user.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={pending}
              className="rounded border px-3 py-1.5 text-sm"
              onClick={() =>
                start(async () => {
                  const res = await fetch("/api/settings/telegram-bind", { method: "POST" });
                  const data = await res.json() as any;
                  if (data.code) setCode(data.code);
                })
              }
            >
              {pending ? "…" : "New code"}
            </button>
            {code ? (
              <span className="font-mono text-lg tracking-widest">{code}</span>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
