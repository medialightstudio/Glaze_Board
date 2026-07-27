// Telegram bot webhook — bind codes + confirm-before-write commands.

import { NextResponse } from "next/server";
import { withOwnerClient } from "@/lib/db-core";
import { parseIntent } from "@/lib/ai";
import { transcribeAudio } from "@/lib/stt";
import {
  telegramAnswerCallback,
  telegramDownloadFile,
  telegramSend,
} from "@/lib/telegram";

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = await req.json() as any;
  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return NextResponse.json({ ok: true });
    }
    const msg = update.message;
    if (!msg?.chat?.id) return NextResponse.json({ ok: true });
    const chatId = String(msg.chat.id);
    let text = msg.text || msg.caption || "";

    if (msg.voice?.file_id) {
      const audio = await telegramDownloadFile(msg.voice.file_id);
      if (audio) {
        text = (await transcribeAudio(audio)) || text;
      }
    }

    if (!text) return NextResponse.json({ ok: true });

    // Bind flow: 6-digit code
    if (/^\d{6}$/.test(text.trim())) {
      await withOwnerClient(async (c) => {
        const { rows } = await c.query(
          `SELECT * FROM messenger_bindings
           WHERE channel = 'telegram' AND bind_code = $1 AND bound_at IS NULL
           ORDER BY created_at DESC LIMIT 1`,
          [text.trim()],
        );
        const row = rows[0];
        if (!row) {
          await telegramSend(chatId, "That code is not recognized.");
          return;
        }
        await c.query("SELECT set_config('app.company_id', $1, true)", [row.company_id]);
        await c.query(
          `UPDATE messenger_bindings
           SET chat_id = $2, bound_at = now(), bind_code = NULL
           WHERE id = $1`,
          [row.id, chatId],
        );
        await telegramSend(chatId, "Bound. You can send commands here.");
      });
      return NextResponse.json({ ok: true });
    }

    const binding = await withOwnerClient(async (c) => {
      const { rows } = await c.query(
        `SELECT * FROM messenger_bindings
         WHERE channel = 'telegram' AND chat_id = $1 AND bound_at IS NOT NULL LIMIT 1`,
        [chatId],
      );
      return rows[0];
    });

    if (!binding) {
      await telegramSend(chatId, "Send your 6-digit Settings code to bind this chat.");
      return NextResponse.json({ ok: true });
    }

    const intent = await parseIntent(text);
    if (!intent) {
      await telegramSend(chatId, "Could not understand. Try again.");
      return NextResponse.json({ ok: true });
    }

    if (["invoice", "pay", "delete", "void"].some((w) => intent.intent.includes(w))) {
      const base = process.env.BETTER_AUTH_URL || "https://glazeboard.com";
      await telegramSend(chatId, `Money and destructive actions stay in the app: ${base}/m`);
      return NextResponse.json({ ok: true });
    }

    await withOwnerClient(async (c) => {
      await c.query("SELECT set_config('app.company_id', $1, true)", [binding.company_id]);
      const { rows } = await c.query(
        `INSERT INTO command_log (company_id, user_id, channel, intent, payload, confirmed)
         VALUES ($1, $2, 'telegram', $3, $4::jsonb, false) RETURNING id`,
        [
          binding.company_id,
          binding.user_id,
          intent.intent,
          JSON.stringify({ entities: intent.entities, text }),
        ],
      );
      const cmdId = rows[0].id;
      await telegramSend(chatId, `Confirm: ${intent.intent}?`, [
        [
          { text: "✅ Confirm", callback_data: `ok:${cmdId}` },
          { text: "✖ Cancel", callback_data: `no:${cmdId}` },
        ],
      ]);
    });
  } catch {
    /* ignore malformed updates */
  }
  return NextResponse.json({ ok: true });
}

async function handleCallback(cq: {
  id: string;
  data?: string;
  message?: { chat?: { id?: number } };
}) {
  const data = cq.data || "";
  const chatId = String(cq.message?.chat?.id || "");
  const [action, cmdId] = data.split(":");
  await telegramAnswerCallback(cq.id);
  if (!cmdId) return;

  await withOwnerClient(async (c) => {
    const { rows } = await c.query(`SELECT * FROM command_log WHERE id = $1`, [cmdId]);
    const cmd = rows[0];
    if (!cmd) return;
    await c.query("SELECT set_config('app.company_id', $1, true)", [cmd.company_id]);
    if (action === "no") {
      await telegramSend(chatId, "Cancelled.");
      return;
    }
    await c.query(`UPDATE command_log SET confirmed = true WHERE id = $1`, [cmdId]);
    if (cmd.intent === "add_note" || cmd.intent === "query") {
      await c.query(
        `INSERT INTO activity_events (company_id, project_id, actor, actor_user_id, verb, details)
         VALUES ($1, NULL, 'telegram', $2, 'command', $3::jsonb)`,
        [cmd.company_id, cmd.user_id, JSON.stringify(cmd.payload)],
      );
    }
    if (cmd.intent === "create_ticket") {
      const note = String((cmd.payload as { entities?: { note?: string } })?.entities?.note || "Telegram ticket");
      await c.query(
        `INSERT INTO tickets (company_id, issue, status, urgency, source)
         VALUES ($1, $2, 'new', 'normal', 'telegram')`,
        [cmd.company_id, note.slice(0, 500)],
      );
    }
    await telegramSend(chatId, `Done: ${cmd.intent}`);
  });
}
