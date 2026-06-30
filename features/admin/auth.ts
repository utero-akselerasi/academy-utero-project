import { userHasAnyRole } from "@/features/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function canAccessAdminDashboard(userId: string) {
  return userHasAnyRole(userId, ["admin"]);
}
