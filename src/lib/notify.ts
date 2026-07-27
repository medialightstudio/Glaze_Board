// Notification door — Resend email; push goes through push.ts with a DB client.

import { Resend } from "resend";
import type { PoolClient } from "@neondatabase/serverless";
import { sendPushToUser, sendPushToOffice } from "@/lib/push";

export async function notifyEmail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return { ok: false as const, reason: "missing" };
  const resend = new Resend(key);
  await resend.emails.send({
    from: "Glaze Board <noreply@glazeboard.com>",
    to,
    subject,
    text,
  });
  return { ok: true as const };
}

export async function notifyDigest(
  client: PoolClient,
  companyId: string,
  opts: { email?: string | null; userId?: string | null; subject: string; body: string },
) {
  if (opts.userId) {
    await sendPushToUser(client, companyId, opts.userId, {
      title: opts.subject,
      body: opts.body,
      url: "/m",
    });
  } else {
    await sendPushToOffice(client, companyId, {
      title: opts.subject,
      body: opts.body,
      url: "/m",
    });
  }
  if (opts.email) await notifyEmail(opts.email, opts.subject, opts.body);
}
