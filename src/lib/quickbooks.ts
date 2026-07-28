// QuickBooks Online OAuth + customer match + invoice + payment poll via fetch.

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

async function tokenRequest(body: URLSearchParams) {
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
    body,
  });
  if (!res.ok) throw new Error("QuickBooks token request failed.");
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
}

export async function qbExchangeCode(code: string, redirectUri: string) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  );
}

export async function qbRefreshToken(refreshToken: string) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );
}

export async function qbFindOrCreateCustomer(
  realmId: string,
  accessToken: string,
  displayName: string,
) {
  const q = encodeURIComponent(`select * from Customer where DisplayName = '${displayName.replace(/'/g, "\\'")}'`);
  const find = await fetch(`${API}/${realmId}/query?query=${q}&minorversion=65`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (find.ok) {
    const data = (await find.json()) as { QueryResponse?: { Customer?: { Id: string }[] } };
    const existing = data.QueryResponse?.Customer?.[0];
    if (existing?.Id) return existing.Id;
  }
  const create = await fetch(`${API}/${realmId}/customer?minorversion=65`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ DisplayName: displayName.slice(0, 100) }),
  });
  if (!create.ok) throw new Error("QB customer create failed.");
  const created = (await create.json()) as { Customer?: { Id?: string } };
  if (!created.Customer?.Id) throw new Error("QB customer missing id.");
  return created.Customer.Id;
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
  return res.json() as Promise<{
    Invoice?: { Id?: string; Balance?: number; InvoiceLink?: string };
  }>;
}

export async function qbGetInvoice(
  realmId: string,
  accessToken: string,
  invoiceId: string,
) {
  const res = await fetch(
    `${API}/${realmId}/invoice/${invoiceId}?minorversion=65`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
  );
  if (!res.ok) return null;
  return res.json() as Promise<{ Invoice?: { Id?: string; Balance?: number } }>;
}

export function detectQbProduct(userAgentHint?: string): "online" | "desktop" {
  if (userAgentHint?.toLowerCase().includes("desktop")) return "desktop";
  return "online";
}
