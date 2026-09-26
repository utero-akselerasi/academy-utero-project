import { resolveStorageUrl } from "@/lib/storage-urls";
import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { type DailyReport, type DailyReportAttachment, type DailyReportWithDetails, type DailyReportReview, type DailyReportWithIntern } from "./types";

/**
 * Menandatangani `file_path` setiap lampiran, di tempat.
 *
 * Ditaruh di lapisan query, bukan di tiap halaman, karena enam pemanggil membaca
 * lampiran yang sama: dashboard peserta, daftar laporan peserta, manajer laporan
 * admin, halaman cetak, dan halaman detail peserta super-admin. Menandatangani
 * per halaman berarti satu halaman baru yang lupa melakukannya akan merender
 * object path mentah sebagai `src` — gambar rusak tanpa pesan error.
 *
 * **Baris `mime_type === "url"` DILEWATI.** Itu tautan Google Drive yang
 * disimpan di kolom yang sama (`features/daily-reports/actions.ts` menulisnya
 * saat peserta menempel link), bukan objek storage. Menandatanganinya akan
 * mengembalikan null — `toObjectPath` menolak URL yang bukan milik bucket ini —
 * jadi setiap tautan Drive akan hilang dari tampilan.
 */
async function signAttachments(attachments: DailyReportAttachment[] | null | undefined) {
  if (!attachments || attachments.length === 0) return [];

  return Promise.all(
    attachments.map(async (att) => {
      if (att.mime_type === "url") return att;
      return { ...att, file_path: await resolveStorageUrl("daily-report", att.file_path) };
    }),
  );
}

/**
 * ID intern_profiles milik satu user. HANYA BACA.
 *
 * Fungsi ini dipanggil dari banyak page (GET) dan dari requireCardAccess, jadi
 * dulu ia membuat baris intern_profiles bila belum ada - menulis di jalur GET
 * tanpa proteksi CSRF maupun jejak audit, dan bisa dipicu prefetch. Lebih
 * buruk: hasilnya dipakai sebagai pembanding otorisasi kepemilikan task, jadi
 * jalur baca ikut membuat data yang menentukan hasil pemeriksaan akses.
 *
 * Pembuatan profil sekarang terjadi sekali di aksi eksplisit yang ber-audit
 * (provisionDomainProfile di features/super-admin/actions.ts). Null di sini
 * berarti profil belum disiapkan - halaman menampilkan pesan setup, bukan
 * membuat profil sendiri.
 */
export async function getInternProfileId(userId: string): Promise<string | null> {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("intern_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Gagal membaca profil peserta:", error);
    return null;
  }

  return data?.id ?? null;
}

export async function getMentorProfileId(userId: string): Promise<string | null> {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("mentor_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Gagal membaca profil admin pembimbing:", error);
    return null;
  }

  return data?.id ?? null;
}

export async function getInternDailyReports(internProfileId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("daily_reports")
    .select("id, intern_id, report_date, today_work, progress, blockers, tomorrow_plan, status, created_at, updated_at, daily_report_attachments(id, report_id, file_path, file_name, mime_type, size_bytes, created_at)")
    .eq("intern_id", internProfileId)
    .order("report_date", { ascending: false })
    .returns<DailyReportWithDetails[]>();

  if (error || !data) {
    return { data: [], error };
  }

  const withSignedAttachments = await Promise.all(
    data.map(async (report) => ({
      ...report,
      daily_report_attachments: await signAttachments(report.daily_report_attachments),
    })),
  );

  return { data: withSignedAttachments, error };
}

/**
 * Laporan harian untuk staf.
 *
 * `allowedInternIds` adalah scope pemanggil: null berarti global (super_admin),
 * array berarti hanya intern tersebut. Sebelumnya fungsi ini selalu memuat
 * SELURUH intern aktif, jadi admin bisa membaca laporan peserta yang bukan
 * bimbingannya padahal aksi review-nya sendiri sudah dibatasi
 * resolveStaffInternScope. Bacaan dan tulisan sekarang memakai scope yang sama.
 */
export async function getMentorDailyReports(allowedInternIds: string[] | null) {
  const db = await createUteroAcademyServiceRoleClient();

  let internIds: string[];

  if (allowedInternIds === null) {
    const { data: activeInterns } = await db
      .from("intern_profiles")
      .select("id")
      .eq("status", "active");

    internIds = (activeInterns || []).map(i => i.id);
  } else {
    internIds = allowedInternIds;
  }

  if (internIds.length === 0) {
    return { data: [], error: null };
  }

  const { data: reports, error } = await db
    .from("daily_reports")
    .select("id, intern_id, report_date, today_work, progress, blockers, tomorrow_plan, status, created_at, updated_at, daily_report_attachments(id, report_id, file_path, file_name, mime_type, size_bytes, created_at), intern_profiles(id, user_id, full_name)")
    .in("intern_id", internIds)
    .order("report_date", { ascending: false })
    .returns<any[]>();

  if (error || !reports) {
    return { data: [], error };
  }

  const { data: userProfiles } = await db
    .from("user_profiles")
    .select("id, full_name");

  const profilesMap = new Map();
  if (userProfiles) {
    userProfiles.forEach((p) => profilesMap.set(p.id, p));
  }

  // `Promise.all` atas `map` asinkron, bukan `.map()` biasa: lampiran harus
  // ditandatangani di sini, dan `.map()` sinkron tidak bisa menunggu.
  const mappedReports = await Promise.all(reports.map(async (report) => {
    const ip = report.intern_profiles;
    const internProfileArray = Array.isArray(ip) ? ip[0] : ip;

    let userProfilesData = null;
    if (internProfileArray) {
      const uProfile = profilesMap.get(internProfileArray.user_id);
      userProfilesData = {
        full_name: uProfile?.full_name || internProfileArray.full_name || "Peserta"
      };
    }

    return {
      ...report,
      daily_report_attachments: await signAttachments(report.daily_report_attachments),
      intern_profiles: internProfileArray ? {
        id: internProfileArray.id,
        user_id: internProfileArray.user_id,
        user_profiles: userProfilesData
      } : null
    };
  }));

  return { data: mappedReports as DailyReportWithIntern[], error: null };
}

export async function getReportReviews(reportId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("daily_report_reviews")
    .select("id, report_id, mentor_id, status, note, created_at")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false })
    .returns<DailyReportReview[]>();

  return { data: data ?? [], error };
}
