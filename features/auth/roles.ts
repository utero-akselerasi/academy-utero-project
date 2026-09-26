import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";

/**
 * Peran login yang berlaku. `admin` adalah administrator SEKALIGUS pembimbing —
 * `mentor` tidak lagi menjadi peran login, dan `admin_academy` melebur ke
 * `admin` (migrasi 0028).
 *
 * Kode legacy TIDAK dihapus dari tabel `roles` dan baris `user_roles` lama
 * dibiarkan utuh — `roles.role_id` adalah ON DELETE CASCADE, jadi menghapusnya
 * akan menghapus riwayat penempatan. Yang mematikan kode legacy adalah union
 * ini: `rolePriority` di bawah berfungsi sebagai allowlist di
 * `getUserRoleCodes`, sehingga kode di luar union disaring keluar dari setiap
 * guard. Menambahkan kembali "mentor" atau "admin_academy" di sini akan
 * menghidupkan ulang keduanya sebagai peran login.
 *
 * Entitas domain tetap bernama `mentor_profiles` / `mentor_assignments` /
 * `mentor_id`, dan `/dashboard/mentor/*` tetap area kerja `admin`. Nama-nama itu
 * bukan peran — jangan ikut diubah.
 */
export type RoleCode = "super_admin" | "admin" | "school" | "intern";

const rolePriority: RoleCode[] = ["super_admin", "admin", "school", "intern"];

const dashboardByRole: Record<RoleCode, string> = {
  super_admin: "/dashboard/super-admin",
  admin: "/dashboard/admin",
  school: "/dashboard/school",
  intern: "/dashboard/intern",
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
