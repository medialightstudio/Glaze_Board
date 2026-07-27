// Customer detail — header, contacts, projects; Direct can't be deleted.

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { getAccount, listContacts, listProjectsForAccount } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { AddContactDialog } from "./add-contact";
import { formatCents } from "@/lib/money";
import { CustomerInvoiceButton } from "./invoice-button";
import { OpsPage, OpsSection } from "@/components/ops/ops-page";

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
    const unbilled = await c.query(
      `SELECT p.id, p.title, p.quote_price_cents FROM projects p
       WHERE p.account_id = $1 AND p.status = 'installed'
         AND NOT EXISTS (
           SELECT 1 FROM invoice_lines il
           JOIN invoices inv ON inv.id = il.invoice_id
           WHERE il.project_id = p.id AND inv.status <> 'void'
         )`,
      [id],
    );
    const unpaid = await c.query(
      `SELECT COALESCE(SUM(balance_cents),0)::int AS n FROM invoices
       WHERE account_id = $1 AND status <> 'void'`,
      [id],
    );
    return {
      account,
      contacts,
      projects,
      unbilled: unbilled.rows,
      unpaid: unpaid.rows[0]?.n || 0,
    };
  });
  if (!data) notFound();

  const { account, contacts, projects, unbilled, unpaid } = data;

  return (
    <OpsPage
      title={account.name}
      purpose={
        [account.phone, account.email].filter(Boolean).join(" · ") ||
        "No phone or email"
      }
      actions={<AddContactDialog accountId={id} />}
    >
      <p>
        <Link
          href="/m/customers"
          className="text-sm text-stone-500 hover:underline"
        >
          ← Customers
        </Link>
      </p>
      <div className="flex gap-2">
        <Badge variant="secondary">{account.billing_type || "per_job"}</Badge>
        {account.is_direct ? <Badge variant="outline">Direct</Badge> : null}
      </div>
      {account.is_direct ? (
        <p className="text-sm text-stone-500">
          Direct is the built-in walk-in account and can&apos;t be deleted.
        </p>
      ) : null}

      <OpsSection title="Contacts">
        {contacts.length === 0 ? (
          <p className="text-sm text-stone-500">No contacts yet.</p>
        ) : (
          <ul className="space-y-2">
            {contacts.map(
              (c: { id: string; name: string; phone?: string; email?: string }) => (
                <li
                  key={c.id}
                  className="flex justify-between rounded border px-3 py-2 text-sm"
                >
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
              ),
            )}
          </ul>
        )}
      </OpsSection>

      <OpsSection title="Projects">
        {projects.length === 0 ? (
          <p className="text-sm text-stone-500">
            No projects yet — use + to quick-create.
          </p>
        ) : (
          <ul className="space-y-2">
            {projects.map((p: { id: string; title: string; status: string }) => (
              <li key={p.id}>
                <Link
                  href={`/m/projects/${p.id}`}
                  className="flex justify-between rounded border px-3 py-2 text-sm hover:bg-stone-50"
                >
                  <span>{p.title}</span>
                  <span className="text-stone-500">
                    {p.status.replace(/_/g, " ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </OpsSection>

      <OpsSection title="Completed & unbilled">
        <p className="text-sm text-stone-600">
          Unpaid balance: {formatCents(unpaid)}
        </p>
        {unbilled.length === 0 ? (
          <p className="text-sm text-stone-500">None.</p>
        ) : (
          <>
            <ul className="space-y-1">
              {unbilled.map(
                (p: {
                  id: string;
                  title: string;
                  quote_price_cents: number | null;
                }) => (
                  <li
                    key={p.id}
                    className="flex justify-between text-sm border-b py-2"
                  >
                    <Link href={`/m/projects/${p.id}`} className="underline">
                      {p.title}
                    </Link>
                    <span className="tabular-nums">
                      {formatCents(p.quote_price_cents || 0)}
                    </span>
                  </li>
                ),
              )}
            </ul>
            <CustomerInvoiceButton
              accountId={id}
              projectIds={unbilled.map((p: { id: string }) => p.id)}
            />
          </>
        )}
      </OpsSection>
    </OpsPage>
  );
}
