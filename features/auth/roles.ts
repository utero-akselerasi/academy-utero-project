import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { backendRequest, usesLocalBackend } from "@/lib/backend/server";

/**
 * Peran login yang berlaku. `admin` mengelola seluruh operasional peserta magang —
 * `mentor` tidak lagi menjadi peran login, dan `admin_academy` melebur ke
 * `admin` (migrasi 0028).
 *
 * Kode legacy tidak mendapat akses login; role-code allowlist di bawah
 * menolak role yang sudah dinonaktifkan. Data profil dan penugasan mentor lama
 * dipindahkan ke skema arsip oleh migrasi backend 9031.
 */
export type RoleCode = "super_admin" | "admin" | "school" | "intern" | "applicant";

const rolePriority: RoleCode[] = ["super_admin", "admin", "school", "intern", "applicant"];

const dashboardByRole: Record<RoleCode, string> = {
  super_admin: "/dashboard/super-admin",
  admin: "/dashboard/admin",
  school: "/dashboard/school",
  intern: "/dashboard/intern",
  applicant: "/dashboard/applicant",
};

/**
 * Apakah sebuah kode dari database masih menjadi peran login yang berlaku.
 *
 * Dipakai di titik yang membaca `user_roles` langsung (bukan lewat
 * `getUserRoleCodes`). Migrasi 0028 sengaja MEMBIARKAN baris peran legacy di
 * database — menghapusnya akan ikut menghapus riwayat penempatan lewat
 * `ON DELETE CASCADE` — jadi kueri mentah ke `user_roles` masih bisa
 * mengembalikan `mentor` atau `admin_academy`. Tanpa penyaringan ini, UI
 * menampilkan peran yang sudah tidak diakui satu pun guard.
 */
export function isActiveRoleCode(code: string | null | undefined): code is RoleCode {
  return rolePriority.includes(code as RoleCode);
}

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
  if (usesLocalBackend()) {
    const response = await backendRequest(`/v1/users/${encodeURIComponent(userId)}/roles`);
    if (response.status === 401) return [];
    if (!response.ok) throw new Error("Gagal membaca role backend lokal.");
    const body = await response.json() as { roles: string[] };
    return body.roles.filter(isActiveRoleCode);
  }
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

  return data.map((row) => normalizeRoleCode(row.roles)).filter(isActiveRoleCode);
}

export async function userHasAnyRole(userId: string, allowedRoles: RoleCode[]) {
  const roleCodes = await getUserRoleCodes(userId);
  return roleCodes.some((roleCode) => allowedRoles.includes(roleCode));
}

export async function userIsSuperAdmin(userId: string) {
  return userHasAnyRole(userId, ["super_admin"]);
}

export async function userIsAdminOrSuperAdmin(userId: string) {
  return userHasAnyRole(userId, ["super_admin", "admin"]);
}

export async function getPrimaryDashboardPath(userId: string) {
  const roleCodes = await getUserRoleCodes(userId);
  return getPrimaryDashboardPathForRoles(roleCodes);
}

export function getPrimaryDashboardPathForRoles(roleCodes: RoleCode[]) {
  const primaryRole = rolePriority.find((roleCode) => roleCodes.includes(roleCode));

  return primaryRole ? dashboardByRole[primaryRole] : null;
}

/**
 * Peran paling tinggi milik user yang juga diizinkan di halaman ini.
 *
 * Pemilihan mengikuti `rolePriority`, BUKAN urutan baris yang dikembalikan
 * database. User dengan lebih dari satu peran (`super_admin` + `admin` adalah
 * kombinasi yang wajar) akan mendapat label dan sidebar yang sama di setiap
 * render — tanpa ini, urutan baris `user_roles` yang berubah bisa membuat
 * sidebar-nya berganti sendiri antar-permintaan.
 *
 * Mengembalikan null kalau tidak ada yang cocok. Pemanggil sudah lewat
 * `requireRole`, jadi null praktis tak tercapai; ia tetap dikembalikan secara
 * eksplisit supaya tidak ada peran yang ditebak-tebak.
 */
export function resolveActiveRole(
  userRoles: RoleCode[],
  allowedRoles: RoleCode[],
): RoleCode | null {
  return (
    rolePriority.find(
      (roleCode) => userRoles.includes(roleCode) && allowedRoles.includes(roleCode),
    ) ?? null
  );
}
