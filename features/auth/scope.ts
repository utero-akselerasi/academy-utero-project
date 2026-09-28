import { getMentorProfileId } from "@/features/daily-reports/queries";
import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { jakartaDateString } from "@/lib/time";
import { getUserRoleCodes } from "./roles";

export type InternScope =
  | { kind: "global" }
  | { kind: "scoped"; internIds: string[] }
  | { kind: "setup_required" };

/**
 * Tentukan intern mana yang boleh dilihat user staff.
 *
 * - `super_admin` → global.
 * - `admin` (termasuk legacy `admin_academy`) → hanya intern dengan
 *   `mentor_assignments` yang masih aktif. Tidak ada fallback global: admin
 *   tanpa assignment mendapat daftar kosong, bukan seluruh intern.
 *
 * Pemanggil WAJIB sudah memverifikasi role lewat guard sebelum memakai ini.
 */
export async function resolveStaffInternScope(userId: string): Promise<InternScope> {
  const roles = await getUserRoleCodes(userId);

  if (roles.includes("super_admin")) {
    return { kind: "global" };
  }

  const mentorProfileId = await getMentorProfileId(userId);
  if (!mentorProfileId) {
    return { kind: "setup_required" };
  }

  const today = jakartaDateString();
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("mentor_assignments")
    .select("intern_id")
    .eq("mentor_id", mentorProfileId)
    .lte("started_at", today)
    .or(`ended_at.is.null,ended_at.gte.${today}`);

  if (error) {
    console.error("Gagal membaca mentor_assignments:", error);
    return { kind: "scoped", internIds: [] };
  }

  const internIds = Array.from(new Set((data ?? []).map((row) => row.intern_id as string)));
  return { kind: "scoped", internIds };
}
