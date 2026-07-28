// Field visit access — assignee or team member; office always allowed.

import type { PoolClient } from "@neondatabase/serverless";
import { isOfficeRole } from "@/lib/auth/session";

export async function canAccessVisit(
  client: PoolClient,
  opts: {
    role: string;
    userId: string;
    visitId: string;
  },
): Promise<boolean> {
  if (isOfficeRole(opts.role)) return true;
  const { rows } = await client.query(
    `SELECT v.id FROM visits v
     LEFT JOIN teams t ON t.id = v.team_id
     WHERE v.id = $1
       AND (
         $2 = ANY (v.assignees)
         OR (t.id IS NOT NULL AND $2 = ANY (t.member_ids))
       )`,
    [opts.visitId, opts.userId],
  );
  return Boolean(rows[0]);
}

export async function companyTodayExpr(client: PoolClient, companyId: string) {
  const { rows } = await client.query(
    `SELECT timezone FROM companies WHERE id = $1`,
    [companyId],
  );
  return rows[0]?.timezone || "America/Los_Angeles";
}
