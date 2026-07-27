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

export async function getMessage(accessToken: string, id: string) {
  const res = await fetch(`${GMAIL_API}/users/me/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<{
    id: string;
    threadId: string;
    payload?: {
      headers?: { name: string; value: string }[];
      parts?: { filename?: string; mimeType?: string; body?: { attachmentId?: string; data?: string } }[];
      body?: { data?: string };
    };
    internalDate?: string;
  }>;
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
