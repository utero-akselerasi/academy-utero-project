import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";

export type RoleCode = "admin" | "school" | "intern";

const rolePriority: RoleCode[] = ["admin", "school", "intern"];

const dashboardByRole: Record<RoleCode, string> = {
  admin: "/dashboard/admin",
  school: "/dashboard/school",
  intern: "/dashboard/intern",
};

type RoleRelation = { code: string } | { code: string }[] | null;

type UserRoleRow = {
  roles: RoleRelation;
};

function normalizeRoleCode(roles: RoleRelation) {
  if (Array.isArray(roles)) {
    return roles[0]?.code;
  }

  return roles?.code;
}

export async function getUserRoleCodes(userId: string): Promise<RoleCode[]> {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("user_roles")
    .select("roles(code)")
    .eq("user_id", userId)
    .returns<UserRoleRow[]>();

  if (error) {
    console.error("Gagal membaca role user:", error);
    return [];
  }

  return data
    .map((row) => normalizeRoleCode(row.roles))
    .filter((code): code is RoleCode => rolePriority.includes(code as RoleCode));
}

export async function userHasAnyRole(userId: string, allowedRoles: RoleCode[]) {
  const roleCodes = await getUserRoleCodes(userId);
  return roleCodes.some((roleCode) => allowedRoles.includes(roleCode));
}

export async function getPrimaryDashboardPath(userId: string) {
  const roleCodes = await getUserRoleCodes(userId);
  const primaryRole = rolePriority.find((roleCode) => roleCodes.includes(roleCode));

  return primaryRole ? dashboardByRole[primaryRole] : null;
}
