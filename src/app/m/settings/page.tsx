// Settings — users admin create form.

import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { CreateUserForm } from "./create-user";
import { PushToggle } from "@/components/push-toggle";

export default async function SettingsPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  const users = await withUser(session, async (c) => {
    const { rows } = await c.query(
      `SELECT id, name, email, role, active FROM "user"
       WHERE company_id = $1 ORDER BY name`,
      [session.companyId],
    );
    return rows;
  });

  const me = await withUser(session, async (c) => {
    const { rows } = await c.query(
      `SELECT push_enabled FROM "user" WHERE id = $1`,
      [session.userId],
    );
    return rows[0] as { push_enabled: boolean } | undefined;
  });

  const isAdmin = session.role === "admin";

  return (
    <div className="p-4 max-w-xl space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <section>
        <h2 className="text-sm font-medium uppercase text-stone-500 mb-2">Notifications</h2>
        <PushToggle initiallyEnabled={Boolean(me?.push_enabled)} />
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase text-stone-500 mb-2">Users</h2>
        <ul className="space-y-2 mb-4">
          {users.map((u: { id: string; name: string; email: string; role: string; active: boolean }) => (
            <li key={u.id} className="flex justify-between rounded border px-3 py-2 text-sm">
              <span>
                {u.name}{" "}
                <span className="text-stone-500">· {u.email}</span>
              </span>
              <span className="text-stone-600">
                {u.role}
                {!u.active ? " (off)" : ""}
              </span>
            </li>
          ))}
        </ul>
        {isAdmin ? (
          <CreateUserForm />
        ) : (
          <p className="text-sm text-stone-500">Only admins can create users.</p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase text-stone-500 mb-2">More</h2>
        <p className="text-sm text-stone-500">
          Teams, mailboxes, QuickBooks, and AI toggles arrive in later phases.
        </p>
      </section>
    </div>
  );
}
