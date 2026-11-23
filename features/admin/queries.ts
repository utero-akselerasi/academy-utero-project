import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { usesLocalBackend } from "@/lib/backend/server";
import { getLocalActiveInterns } from "./local";

async function localInterns() {
  return (await getLocalActiveInterns()).interns;
}

/**
 * Daftar peserta aktif, HANYA BACA.
 *
 * Versi sebelumnya menyisipkan baris `intern_profiles` untuk setiap user
 * berperan intern yang belum punya profil. Itu berarti sekadar membuka halaman
 * (GET, bisa dipicu prefetch) menulis data - tanpa proteksi CSRF, tanpa jejak
 * audit, dan baris yang dibuat selalu tanpa email dengan nama fallback
 * "Peserta Magang". Pembuatan profil sekarang urusan onboarding eksplisit;
 * fungsi ini tidak lagi menulis apa pun.
 *
 * Sekaligus menghapus N+1 query: satu query intern_profiles, bukan satu per
 * user.
 */
export async function getActiveInterns() {
  if (usesLocalBackend()) return localInterns();
  const db = await createUteroAcademyServiceRoleClient();

  // Fetch user_roles who have role code = intern
  const { data: userRoles } = await db
    .from("user_roles")
    .select("user_id, roles(code)")
    .returns<any[]>();

  const internUserIds = (userRoles || [])
    .filter(ur => {
      const r = ur.roles;
      const code = Array.isArray(r) ? r[0]?.code : r?.code;
      return code === "intern";
    })
    .map(ur => ur.user_id as string);

  if (internUserIds.length === 0) {
    return [];
  }

  const { data: profiles, error } = await db
    .from("intern_profiles")
    .select("id, full_name, email, major, status")
    .eq("status", "active")
    .in("user_id", internUserIds);

  if (error) {
    console.error("Gagal membaca daftar peserta aktif:", error);
    return [];
  }

  return (profiles ?? []).sort((a, b) => a.full_name.localeCompare(b.full_name));
}
