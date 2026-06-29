import { logoutAction } from "@/features/auth/actions";
import { type RoleCode, userHasAnyRole } from "@/features/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

type Props = {
  allowedRoles: RoleCode[];
  title: string;
  homeHref: string;
  children: React.ReactNode;
};

export async function ProtectedDashboardLayout({ allowedRoles, title, homeHref, children }: Props) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const allowed = await userHasAnyRole(user.id, allowedRoles);

  if (!allowed) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link className="font-bold text-slate-950" href={homeHref}>
            {title}
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

