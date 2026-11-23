import { getUserRoleCodes } from "./roles";

export type InternScope =
  | { kind: "global" }
  | { kind: "scoped"; internIds: string[] }
  | { kind: "setup_required" };

/**
 * Tentukan intern mana yang boleh dilihat user staff.
 *
 * Admin dan super admin mengelola seluruh peserta magang.
 *
 * Pemanggil WAJIB sudah memverifikasi role lewat guard sebelum memakai ini.
 */
export async function resolveStaffInternScope(userId: string): Promise<InternScope> {
  const roles = await getUserRoleCodes(userId);

  if (roles.includes("super_admin") || roles.includes("admin")) {
    return { kind: "global" };
  }
  return { kind: "setup_required" };
}
