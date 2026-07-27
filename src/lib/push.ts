// Web-push sender — used for gate flips and urgent tickets.

import webpush from "web-push";
import type { PoolClient } from "@neondatabase/serverless";

function configured() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || "";
}

export async function sendPushToUser(
  client: PoolClient,
  companyId: string,
  userId: string,
  payload: { title: string; body: string; url?: string },
) {
  if (!configured()) return { sent: 0, skipped: "vapid_missing" as const };

  const enabled = await client.query(
    `SELECT push_enabled FROM "user" WHERE id = $1 AND company_id = $2`,
    [userId, companyId],
  );
  if (!enabled.rows[0]?.push_enabled) return { sent: 0, skipped: "disabled" as const };

  const subs = await client.query(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions
     WHERE company_id = $1 AND user_id = $2`,
    [companyId, userId],
  );
  if (subs.rows.length === 0) return { sent: 0, skipped: "no_sub" as const };

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  let sent = 0;
  for (const s of subs.rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        },
        JSON.stringify(payload),
      );
      sent += 1;
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        await client.query(
          `DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2`,
          [s.endpoint, userId],
        );
      }
      // Workers runtime may reject web-push — caller notes OBSERVED / DECISION NEEDED.
    }
  }
  return { sent };
}

export async function sendPushToOffice(
  client: PoolClient,
  companyId: string,
  payload: { title: string; body: string; url?: string },
) {
  const office = await client.query(
    `SELECT id FROM "user"
     WHERE company_id = $1 AND role IN ('admin','manager') AND active = true AND push_enabled = true`,
    [companyId],
  );
  let total = 0;
  for (const u of office.rows) {
    const r = await sendPushToUser(client, companyId, u.id, payload);
    total += r.sent;
  }
  return { sent: total };
}
