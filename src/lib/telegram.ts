// Telegram Bot API via fetch — bind codes + confirm callbacks.

const API = "https://api.telegram.org";

function token() {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

export function telegramConfigured() {
  return Boolean(token());
}

export async function telegramSend(
  chatId: string,
  text: string,
  buttons?: { text: string; callback_data: string }[][],
) {
  if (!token()) return;
  await fetch(`${API}/bot${token()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: buttons
        ? { inline_keyboard: buttons.map((row) => row.map((b) => b)) }
        : undefined,
    }),
  });
}

export async function telegramAnswerCallback(id: string, text?: string) {
  if (!token()) return;
  await fetch(`${API}/bot${token()}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: id, text }),
  });
}

export async function telegramDownloadFile(fileId: string): Promise<ArrayBuffer | null> {
  if (!token()) return null;
  const meta = await fetch(`${API}/bot${token()}/getFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  if (!meta.ok) return null;
  const data = (await meta.json()) as { result?: { file_path?: string } };
  const path = data.result?.file_path;
  if (!path) return null;
  const file = await fetch(`${API}/file/bot${token()}/${path}`);
  if (!file.ok) return null;
  return file.arrayBuffer();
}

export function randomBindCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
