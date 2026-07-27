// Settings — users, connections, messenger bind, autonomy toggles.

import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { CreateUserForm } from "./create-user";
import { PushToggle } from "@/components/push-toggle";
import { ConnectionsPanel } from "./connections";
import { AutonomyToggles } from "./autonomy";
import { TelegramBind } from "./telegram-bind";

export default async function SettingsPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  const data = await withUser(session, async (c) => {
    const users = await c.query(
      `SELECT id, name, email, role, active FROM "user"
       WHERE company_id = $1 ORDER BY name`,
      [session.companyId],
    );
    const me = await c.query(`SELECT push_enabled FROM "user" WHERE id = $1`, [
      session.userId,
    ]);
    const mail = await c.query(
      `SELECT purpose, email, connected_at FROM mail_accounts WHERE company_id = $1`,
      [session.companyId],
    );
    const qb = await c.query(
      `SELECT product, connected_at, realm_id FROM qb_connections WHERE company_id = $1`,
      [session.companyId],
    );
    const autonomy = await c.query(
      `SELECT toggles FROM autonomy_settings WHERE company_id = $1`,
      [session.companyId],
    );
    const company = await c.query(
      `SELECT crl_bridge_enabled, crl_tos_accepted FROM companies WHERE id = $1`,
      [session.companyId],
    );
    const bind = await c.query(
      `SELECT bind_code, chat_id, bound_at FROM messenger_bindings
       WHERE company_id = $1 AND user_id = $2 AND channel = 'telegram'
       ORDER BY created_at DESC LIMIT 1`,
      [session.companyId, session.userId],
    );
    return {
      users: users.rows,
      me: me.rows[0] as { push_enabled: boolean } | undefined,
      mail: mail.rows,
      qb: qb.rows[0] || null,
      toggles: (autonomy.rows[0]?.toggles || {}) as Record<string, boolean>,
      company: company.rows[0],
      telegram: bind.rows[0] || null,
    };
  });

  const isAdmin = session.role === "admin";

  return (
    <div className="p-4 max-w-xl space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <section>
        <h2 className="text-sm font-medium uppercase text-stone-500 mb-2">Notifications</h2>
        <PushToggle initiallyEnabled={Boolean(data.me?.push_enabled)} />
      </section>

      <ConnectionsPanel
        mail={data.mail}
        qb={data.qb}
        crlEnabled={Boolean(data.company?.crl_bridge_enabled)}
        crlTos={Boolean(data.company?.crl_tos_accepted)}
        isAdmin={isAdmin}
      />

      <TelegramBind
        bindCode={data.telegram?.bind_code || null}
        bound={Boolean(data.telegram?.bound_at)}
        chatId={data.telegram?.chat_id || null}
      />

      <AutonomyToggles initial={data.toggles} isAdmin={isAdmin} />

      <section>
        <h2 className="text-sm font-medium uppercase text-stone-500 mb-2">Users</h2>
        <ul className="space-y-2 mb-4">
          {data.users.map(
            (u: { id: string; name: string; email: string; role: string; active: boolean }) => (
              <li key={u.id} className="flex justify-between rounded border px-3 py-2 text-sm">
                <span>
                  {u.name} <span className="text-stone-500">· {u.email}</span>
                </span>
                <span className="text-stone-600">
                  {u.role}
                  {!u.active ? " (off)" : ""}
                </span>
              </li>
            ),
          )}
        </ul>
        {isAdmin ? (
          <CreateUserForm />
        ) : (
          <p className="text-sm text-stone-500">Only admins can create users.</p>
        )}
      </section>
    </div>
  );
}
