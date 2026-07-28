// Telegram bot — bind, ignore unknowns, confirm → same domain actions as UI.

import { NextResponse } from "next/server";
import { withOwnerClient } from "@/lib/db-core";
import { parseIntent } from "@/lib/ai";
import { transcribeAudio } from "@/lib/stt";
import {
  telegramAnswerCallback,
  telegramDownloadFile,
  telegramSend,
} from "@/lib/telegram";
import { createProject, ensureDirectAccount } from "@/lib/db";
import { transition, type Status } from "@/lib/status-machine";

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await req.json()) as any;
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
      if (audio) text = (await transcribeAudio(audio)) || text;
    }
    if (!text) return NextResponse.json({ ok: true });

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
           SET chat_id = $2, bound_at = now(), bind_code = NULL WHERE id = $1`,
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
      await withOwnerClient(async (c) => {
        const co = await c.query(`SELECT id FROM companies WHERE status = 'active' LIMIT 1`);
        if (co.rows[0]) {
          await c.query("SELECT set_config('app.company_id', $1, true)", [co.rows[0].id]);
          await c.query(
            `INSERT INTO command_log (company_id, user_id, channel, intent, payload, confirmed)
             VALUES ($1, NULL, 'telegram_security', 'unknown_chat', $2::jsonb, false)`,
            [co.rows[0].id, JSON.stringify({ chat_id: chatId, text: text.slice(0, 200) })],
          );
        }
      }).catch(() => undefined);
      // Ignore unknowns — no helpful bind spam (systems §1.1)
      return NextResponse.json({ ok: true });
    }

    const intent = await parseIntent(text);
    if (!intent) {
      await telegramSend(chatId, "Could not understand. Try again.");
      return NextResponse.json({ ok: true });
    }

    const moneyLike = /invoice|pay|delete|void|billing/i.test(intent.intent + text);
    if (moneyLike) {
      const base = process.env.BETTER_AUTH_URL || "https://glazeboard.com";
      await telegramSend(chatId, `Open Billing in the app: ${base}/m/billing`);
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
      await telegramSend(chatId, `Confirm: ${intent.intent}?`, [
        [
          { text: "✅ Confirm", callback_data: `ok:${rows[0].id}` },
          { text: "✖ Cancel", callback_data: `no:${rows[0].id}` },
        ],
      ]);
    });
  } catch {
    /* ignore */
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
    await c.query("SELECT set_config('app.role', 'manager', true)");
    if (action === "no") {
      await telegramSend(chatId, "Cancelled.");
      return;
    }
    await c.query(`UPDATE command_log SET confirmed = true WHERE id = $1`, [cmdId]);

    const payload = cmd.payload as {
      entities?: Record<string, unknown>;
      text?: string;
    };
    const entities = payload.entities || {};
    const note = String(entities.note || payload.text || "");
    const session = {
      companyId: cmd.company_id as string,
      role: "manager",
      userId: String(cmd.user_id || "telegram"),
    };

    if (cmd.intent === "create_project") {
      const direct = await ensureDirectAccount(c, session.companyId);
      const address = String(entities.address || note || "Address TBD");
      const project = await createProject(c, session.companyId, {
        account_id: direct.id,
        site_address: address,
        note: note || undefined,
        account_name: String(entities.account || direct.name),
      });
      await c.query(
        `INSERT INTO activity_events (company_id, project_id, actor, actor_user_id, verb, details)
         VALUES ($1, $2, 'telegram', $3, 'command', $4::jsonb)`,
        [
          session.companyId,
          project.id,
          session.userId,
          JSON.stringify({ via: "Telegram", intent: cmd.intent }),
        ],
      );
      await telegramSend(chatId, `Created: ${project.title}`);
      return;
    }

    if (cmd.intent === "create_ticket") {
      await c.query(
        `INSERT INTO tickets (company_id, issue, status, urgency, source)
         VALUES ($1, $2, 'new', 'normal', 'telegram')`,
        [session.companyId, note.slice(0, 500) || "Telegram ticket"],
      );
      await telegramSend(chatId, "Ticket created.");
      return;
    }

    if (cmd.intent === "book_visit") {
      const projectHint = String(entities.project_hint || "");
      let projectId = String(entities.project_id || "");
      if (!projectId && projectHint) {
        const p = await c.query(
          `SELECT id FROM projects WHERE title ILIKE $1 ORDER BY updated_at DESC LIMIT 1`,
          [`%${projectHint}%`],
        );
        projectId = p.rows[0]?.id || "";
      }
      if (!projectId) {
        await telegramSend(chatId, "Need a project to book a visit.");
        return;
      }
      await c.query(
        `INSERT INTO visits (company_id, type, project_id, starts_at, assignees)
         VALUES ($1, $2, $3, now() + interval '1 day', $4)`,
        [
          session.companyId,
          String(entities.status || "measure"),
          projectId,
          [session.userId],
        ],
      );
      await telegramSend(chatId, "Visit booked for tomorrow.");
      return;
    }

    if (cmd.intent === "update_status") {
      const projectId = String(entities.project_id || "");
      const to = String(entities.status || "") as Status;
      if (!projectId || !to) {
        await telegramSend(chatId, "Need project_id and status.");
        return;
      }
      await transition(c, session, projectId, to, {
        kind: "telegram",
        userId: session.userId,
      });
      await telegramSend(chatId, `Status → ${to}`);
      return;
    }

    if (cmd.intent === "add_note") {
      const projectId = String(entities.project_id || "");
      await c.query(
        `INSERT INTO activity_events (company_id, project_id, actor, actor_user_id, verb, details)
         VALUES ($1, $2, 'telegram', $3, 'note', $4::jsonb)`,
        [
          session.companyId,
          projectId || null,
          session.userId,
          JSON.stringify({ note, via: "Telegram" }),
        ],
      );
      await telegramSend(chatId, "Note saved.");
      return;
    }

    await telegramSend(chatId, `Done: ${cmd.intent}`);
  });
}
