import { logoutAction } from "@/features/auth/actions";
import { canAccessAdminDashboard, getCurrentUser } from "@/features/admin/auth";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const allowed = await canAccessAdminDashboard(user.id);

  if (!allowed) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link
            className="font-bold text-slate-950"
            href="/dashboard/admin/pendaftaran">
            Dashboard Admin
          </Link>
          <form action={logoutAction}>
            <button className="button-secondary text-sm" type="submit">
              <LogOut size={16} />
              Keluar
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
