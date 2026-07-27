// In-app notification list.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";

export default async function NotificationsPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  const rows = await withUser(session, async (c) => {
    const { rows: list } = await c.query(
      `SELECT id, title, body, href, read_at, created_at
       FROM notifications WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [session.userId],
    );
    await c.query(
      `UPDATE notifications SET read_at = now()
       WHERE user_id = $1 AND read_at IS NULL`,
      [session.userId],
    );
    return list;
  });

  return (
    <div className="p-4 max-w-xl space-y-3">
      <h1 className="text-xl font-semibold">Notifications</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-stone-500">You&apos;re caught up.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(
            (n: {
              id: string;
              title: string;
              body?: string;
              href?: string;
              read_at?: string;
              created_at: string;
            }) => (
              <li
                key={n.id}
                className={`rounded border px-3 py-2 text-sm ${n.read_at ? "" : "bg-stone-50"}`}
              >
                {n.href ? (
                  <Link href={n.href} className="font-medium hover:underline">
                    {n.title}
                  </Link>
                ) : (
                  <span className="font-medium">{n.title}</span>
                )}
                {n.body ? <p className="text-stone-600">{n.body}</p> : null}
                <p className="text-xs text-stone-400 mt-1">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
