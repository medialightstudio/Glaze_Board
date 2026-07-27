// Customer detail — header, contacts, projects; Direct can't be deleted.

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { getAccount, listContacts, listProjectsForAccount } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { AddContactDialog } from "./add-contact";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAppSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const data = await withUser(session, async (c) => {
    const account = await getAccount(c, id);
    if (!account) return null;
    const contacts = await listContacts(c, id);
    const projects = await listProjectsForAccount(c, id);
    return { account, contacts, projects };
  });
  if (!data) notFound();

  const { account, contacts, projects } = data;

  return (
    <div className="p-4 max-w-3xl space-y-6">
      <div>
        <Link href="/m/customers" className="text-sm text-stone-500 hover:underline">
          ← Customers
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{account.name}</h1>
            <p className="text-sm text-stone-600">
              {[account.phone, account.email].filter(Boolean).join(" · ") || "No phone or email"}
            </p>
            <div className="mt-1 flex gap-2">
              <Badge variant="secondary">{account.billing_type || "per_job"}</Badge>
              {account.is_direct ? <Badge variant="outline">Direct</Badge> : null}
            </div>
          </div>
        </div>
        {account.is_direct ? (
          <p className="mt-2 text-sm text-stone-500">
            Direct is the built-in walk-in account and can&apos;t be deleted.
          </p>
        ) : null}
      </div>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium uppercase text-stone-500">Contacts</h2>
          <AddContactDialog accountId={id} />
        </div>
        {contacts.length === 0 ? (
          <p className="text-sm text-stone-500">No contacts yet.</p>
        ) : (
          <ul className="space-y-2">
            {contacts.map((c: { id: string; name: string; phone?: string; email?: string }) => (
              <li key={c.id} className="flex justify-between rounded border px-3 py-2 text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="text-stone-600">
                  {c.phone ? (
                    <a href={`tel:${c.phone}`} className="hover:underline">
                      {c.phone}
                    </a>
                  ) : (
                    c.email || "—"
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase text-stone-500 mb-2">Projects</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-stone-500">No projects yet — use + to quick-create.</p>
        ) : (
          <ul className="space-y-2">
            {projects.map((p: { id: string; title: string; status: string }) => (
              <li key={p.id}>
                <Link
                  href={`/m/projects/${p.id}`}
                  className="flex justify-between rounded border px-3 py-2 text-sm hover:bg-stone-50"
                >
                  <span>{p.title}</span>
                  <span className="text-stone-500">{p.status.replace(/_/g, " ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase text-stone-500 mb-2">
          Completed & unbilled
        </h2>
        <p className="text-sm text-stone-500">Arrives with Billing.</p>
      </section>
    </div>
  );
}
