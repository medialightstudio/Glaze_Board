// Management portal shell — office only; field redirected to /f.

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth/auth";
import { isOfficeRole } from "@/lib/auth/session";
import { AppHeader } from "@/components/app-header";
import { MMobileTabs, MSidebar } from "@/components/m-nav";
import { QuickCreate } from "@/components/quick-create";
import { withUser } from "@/lib/db-core";

export default async function MLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const user = session.user as {
    id: string;
    name: string;
    company_id?: string | null;
    role?: string | null;
  };

  if (!user.company_id || !user.role) redirect("/login");
  if (!isOfficeRole(user.role)) redirect("/f");

  let companyName = "Glaze Board";
  try {
    companyName = await withUser(
      { userId: user.id, companyId: user.company_id, role: user.role },
      async (client) => {
        const { rows } = await client.query<{ name: string }>(
          "SELECT name FROM companies WHERE id = $1",
          [user.company_id],
        );
        return rows[0]?.name || companyName;
      },
    );
  } catch {
    // DB may be unconfigured during early scaffold — keep default name.
  }

  return (
    <div className="min-h-screen bg-white pb-16 md:pb-0">
      <AppHeader companyName={companyName} userName={user.name} />
      <div className="flex">
        <MSidebar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <QuickCreate />
      <MMobileTabs />
    </div>
  );
}
