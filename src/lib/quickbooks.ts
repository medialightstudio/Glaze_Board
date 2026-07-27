// QuickBooks Online OAuth + invoice helpers via fetch.

const AUTH = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const API = "https://quickbooks.api.intuit.com/v3/company";

export function qbConfigured() {
  return Boolean(process.env.QB_CLIENT_ID && process.env.QB_CLIENT_SECRET);
}

export function qbAuthUrl(state: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: process.env.QB_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    state,
  });
  return `${AUTH}?${params}`;
}

export async function qbExchangeCode(code: string, redirectUri: string) {
  const basic = Buffer.from(
    `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`,
  ).toString("base64");
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error("QuickBooks token exchange failed.");
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    x_refresh_token_expires_in: number;
  }>;
}

export async function qbCreateInvoice(
  realmId: string,
  accessToken: string,
  customerRef: string,
  lines: { description: string; amountDollars: number }[],
) {
  const body = {
    Line: lines.map((l, i) => ({
      Id: String(i + 1),
      Amount: l.amountDollars,
      DetailType: "SalesItemLineDetail",
      Description: l.description,
      SalesItemLineDetail: { Qty: 1, UnitPrice: l.amountDollars },
    })),
    CustomerRef: { value: customerRef },
  };
  const res = await fetch(`${API}/${realmId}/invoice?minorversion=65`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`QB invoice failed: ${err.slice(0, 200)}`);
  }
  return res.json() as Promise<{ Invoice?: { Id?: string } }>;
}

export function detectQbProduct(userAgentHint?: string): "online" | "desktop" {
  if (userAgentHint?.toLowerCase().includes("desktop")) return "desktop";
  return "online";
}
