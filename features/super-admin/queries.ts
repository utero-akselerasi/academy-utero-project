import { createUteroAcademyClient } from "@/lib/supabase/server";
import { type Role, type UserProfile, type UserRole } from "./types";

export async function getSuperAdminUserManagementData() {
  const db = await createUteroAcademyClient();

  const [profilesResult, rolesResult, userRolesResult] = await Promise.all([
    db
      .from("user_profiles")
      .select("id, full_name, phone, is_active, created_at")
      .order("created_at", { ascending: false })
      .returns<UserProfile[]>(),
    db.from("roles").select("id, code, name, description").order("name").returns<Role[]>(),
    db
      .from("user_roles")
      .select("id, user_id, role_id, roles(code, name)")
      .returns<UserRole[]>(),
  ]);

  return {
    profiles: profilesResult.data ?? [],
    roles: rolesResult.data ?? [],
    userRoles: userRolesResult.data ?? [],
    error: profilesResult.error ?? rolesResult.error ?? userRolesResult.error,
  };
}

