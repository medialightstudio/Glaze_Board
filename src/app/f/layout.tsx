// Field shell — any signed-in user; office may open for oversight.

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth/auth";
import Link from "next/link";

export default async function FLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  const role = (session.user as { role?: string }).role || "field";
  const office = role === "admin" || role === "manager";

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <div className="font-semibold">Glaze Board · Field</div>
        {office ? (
          <Link href="/m" className="text-sm rounded border px-2 py-1 hover:bg-stone-50">
            Back to office
          </Link>
        ) : null}
      </header>
      {children}
    </div>
  );
}
