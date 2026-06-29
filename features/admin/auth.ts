import { createSupabaseServerClient, createUteroAcademyClient } from "@/lib/supabase/server";

const adminRoles = new Set(["super_admin", "admin_academy"]);

type RoleRow = {
  roles: {
    code: string;
  } | null;
};

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function canAccessAdminDashboard(userId: string) {
  const db = await createUteroAcademyClient();
  const { data, error } = await db
    .from("user_roles")
    .select("roles(code)")
    .eq("user_id", userId)
    .returns<RoleRow[]>();

  if (error) {
    return false;
  }

  return data.some((row) => row.roles?.code && adminRoles.has(row.roles.code));
}

