// Gmail adapter — OAuth + list/watch via fetch (no googleapis SDK).

const GMAIL_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GMAIL_TOKEN = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

export function gmailConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function gmailAuthUrl(state: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.modify",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GMAIL_AUTH}?${params}`;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const res = await fetch(GMAIL_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error("Gmail token exchange failed.");
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }>;
}

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(GMAIL_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Gmail refresh failed.");
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function listRecentMessages(accessToken: string, max = 10) {
  const res = await fetch(
    `${GMAIL_API}/users/me/messages?maxResults=${max}&q=${encodeURIComponent("has:attachment")}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { messages?: { id: string }[] };
  return data.messages || [];
}

export type GmailPart = {
  filename?: string;
  mimeType?: string;
  body?: { attachmentId?: string; data?: string; size?: number };
  parts?: GmailPart[];
};

export async function getMessage(accessToken: string, id: string) {
  const res = await fetch(`${GMAIL_API}/users/me/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<{
    id: string;
    threadId: string;
    payload?: GmailPart & { headers?: { name: string; value: string }[] };
    internalDate?: string;
  }>;
}

export async function getAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<Uint8Array | null> {
  const res = await fetch(
    `${GMAIL_API}/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { data?: string };
  if (!data.data) return null;
  const b64 = data.data.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

export function collectAttachments(payload?: GmailPart): {
  filename: string;
  mimeType: string;
  attachmentId: string;
}[] {
  const out: { filename: string; mimeType: string; attachmentId: string }[] = [];
  function walk(part?: GmailPart) {
    if (!part) return;
    if (part.body?.attachmentId && part.filename) {
      out.push({
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        attachmentId: part.body.attachmentId,
      });
    }
    for (const p of part.parts || []) walk(p);
  }
  walk(payload);
  return out;
}

export async function getProfileEmail(accessToken: string) {
  const res = await fetch(`${GMAIL_API}/users/me/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { emailAddress?: string };
  return data.emailAddress || null;
}

export async function labelFiled(accessToken: string, messageId: string) {
  // Ensure label exists then apply
  let labelId: string | null = null;
  const list = await fetch(`${GMAIL_API}/users/me/labels`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (list.ok) {
    const data = (await list.json()) as { labels?: { id: string; name: string }[] };
    labelId = data.labels?.find((l) => l.name === "Filed by system")?.id || null;
  }
  if (!labelId) {
    const created = await fetch(`${GMAIL_API}/users/me/labels`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Filed by system",
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      }),
    });
    if (created.ok) {
      const data = (await created.json()) as { id?: string };
      labelId = data.id || null;
    }
  }
  if (!labelId) return false;
  const res = await fetch(`${GMAIL_API}/users/me/messages/${messageId}/modify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ addLabelIds: [labelId] }),
  });
  return res.ok;
}

export function supplierLooking(from: string, subject: string) {
  const hay = `${from} ${subject}`.toLowerCase();
  return (
    hay.includes("glassfab") ||
    hay.includes("crlaurence") ||
    hay.includes("crl ") ||
    /\b(po|order|ack|invoice|packing)\b/.test(hay)
  );
}
