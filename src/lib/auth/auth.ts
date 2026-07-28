// Better Auth — email/password; sessions carry company_id + role for withUser.
// Cloudflare Workers: create Pool+auth per request (React cache). Module-scope Pool → Error 1101.

import { cache } from "react";
import { betterAuth } from "better-auth";
import { Pool } from "@neondatabase/serverless";

export function createAuth() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is blank.");
  const pool = new Pool({ connectionString: url, max: 1 });
  return betterAuth({
    database: pool,
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url: resetUrl }) => {
        const key = process.env.RESEND_API_KEY;
        if (!key) {
          console.error("RESEND_API_KEY blank — password reset email not sent.");
          return;
        }
        const { Resend } = await import("resend");
        const resend = new Resend(key);
        await resend.emails.send({
          from: "Glaze Board <noreply@glazeboard.com>",
          to: user.email,
          subject: "Reset your Glaze Board password",
          text: `Reset your password: ${resetUrl}`,
        });
      },
    },
    user: {
      additionalFields: {
        company_id: { type: "string", required: false, input: false },
        role: {
          type: "string",
          required: false,
          defaultValue: "field",
          input: false,
        },
        platform_admin: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
        active: {
          type: "boolean",
          required: false,
          defaultValue: true,
          input: false,
        },
        phone: { type: "string", required: false, input: true },
      },
    },
    session: {
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },
    trustedOrigins: [process.env.BETTER_AUTH_URL || "http://localhost:3000"],
  });
}

/** One auth/Pool instance per incoming Next.js request. */
export const getAuth = cache(createAuth);

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
