// Speech-to-text via OpenAI-compatible transcription API (Telegram voice).

export async function transcribeAudio(
  bytes: ArrayBuffer,
  filename = "voice.ogg",
): Promise<string | null> {
  const key = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return null;
  const base = process.env.LLM_API_BASE || "https://api.openai.com/v1";
  const form = new FormData();
  form.append("file", new Blob([bytes]), filename);
  form.append("model", process.env.STT_MODEL || "whisper-1");
  const res = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { text?: string };
  return data.text || null;
}
