// Server session helpers — map Better Auth session into AppSession for db-core.

import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import type { AppSession } from "@/lib/db-core";

export async function getAppSession(): Promise<AppSession | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const user = session.user as {
    id: string;
    company_id?: string | null;
    role?: string | null;
    active?: boolean | null;
  };
  if (!user.company_id || !user.role || user.active === false) return null;
  return {
    userId: user.id,
    companyId: user.company_id,
    role: user.role,
  };
}

export function isOfficeRole(role: string) {
  return role === "admin" || role === "manager";
}
