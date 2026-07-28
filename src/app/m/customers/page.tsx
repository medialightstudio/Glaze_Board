// Customers table + add-customer dialog.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db-core";
import { listAccounts } from "@/lib/db";
import { AddCustomerDialog } from "./add-dialog";
import { OpsPage } from "@/components/ops/ops-page";

export default async function CustomersPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  const accounts = await withUser(session, (c) => listAccounts(c));

  return (
    <OpsPage
      title="Customers"
      purpose="Contractors and Direct — every job links here."
      actions={<AddCustomerDialog />}
    >
      {accounts.length === 0 ? (
        <p className="text-sm text-stone-500">No customers yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500 border-b">
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium hidden sm:table-cell">Phone</th>
              <th className="py-2 font-medium">Billing</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a: { id: string; name: string; phone?: string; billing_type?: string; is_direct?: boolean }) => (
              <tr key={a.id} className="border-b hover:bg-stone-50">
                <td className="py-2">
                  <Link href={`/m/customers/${a.id}`} className="font-medium hover:underline">
                    {a.name}
                    {a.is_direct ? (
                      <span className="ml-2 text-xs text-stone-500">Direct</span>
                    ) : null}
                  </Link>
                </td>
                <td className="py-2 hidden sm:table-cell text-stone-600">{a.phone || "—"}</td>
                <td className="py-2 text-stone-600">{a.billing_type || "per_job"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </OpsPage>
  );
}
