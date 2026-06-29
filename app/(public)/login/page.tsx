import { LoginForm } from "@/features/auth/LoginForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPrimaryDashboardPath } from "@/features/auth/roles";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    const dashboardPath = await getPrimaryDashboardPath(user.id);
    if (dashboardPath) {
      redirect(dashboardPath);
    }
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-md content-center px-4 py-12">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase text-teal-700">Dashboard</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Login Utero Academy</h1>
        <p className="mt-2 leading-7 text-slate-600">
          Satu pintu masuk untuk admin, mentor, sekolah, dan peserta.
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
