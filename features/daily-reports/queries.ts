import { resolveStorageUrl } from "@/lib/storage-urls";
import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { type DailyReport, type DailyReportAttachment, type DailyReportWithDetails, type DailyReportReview, type DailyReportWithIntern } from "./types";
import { usesLocalBackend } from "@/lib/backend/mode";
import { localProfiles, localReports, localReviews } from "./local";

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
  if (usesLocalBackend()) return (await localProfiles()).internProfileId;
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

type ReportListOptions = { page?: number; status?: string; limit?: number };

export async function getInternDailyReports(internProfileId: string, options: ReportListOptions = {}) {
  if (usesLocalBackend()) return { data: await localReports(internProfileId, options) as DailyReportWithDetails[], error: null };
  const db = await createUteroAcademyServiceRoleClient();
  let query = db
    .from("daily_reports")
    .select("id, intern_id, report_date, today_work, progress, blockers, tomorrow_plan, status, created_at, updated_at")
    .eq("intern_id", internProfileId)
    .order("report_date", { ascending: false });

  if (options.status && options.status !== "all") query = query.eq("status", options.status);
  if (options.limit) {
    const page = Math.max(1, options.page ?? 1);
    query = query.range((page - 1) * options.limit, page * options.limit - 1);
  }
  const { data, error } = await query.returns<DailyReport[]>();

  if (error || !data) {
    return { data: [], error };
  }

  return { data: data.map((report) => ({ ...report, daily_report_attachments: [] })) as DailyReportWithDetails[], error };
}

export async function getDailyReportDetail(reportId: string, internProfileId: string) {
  if (usesLocalBackend()) {
    const reports = await localReports(internProfileId, { reportId, includeAttachments: true });
    return reports.find((report) => report.id === reportId) ?? null;
  }
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db.from("daily_reports")
    .select("id, intern_id, report_date, today_work, progress, blockers, tomorrow_plan, status, created_at, updated_at, daily_report_attachments(id, report_id, file_path, file_name, mime_type, size_bytes, created_at)")
    .eq("id", reportId).eq("intern_id", internProfileId).maybeSingle<DailyReportWithDetails>();
  if (error || !data) return null;
  return { ...data, daily_report_attachments: await signAttachments(data.daily_report_attachments) };
}

export async function getStaffDailyReportDetail(reportId: string, allowedInternIds: string[] | null) {
  if (usesLocalBackend()) {
    const reports = await localReports(null, { reportId, includeAttachments: true });
    return reports.find((report) => report.id === reportId) ?? null;
  }
  const db = await createUteroAcademyServiceRoleClient();
  let query = db.from("daily_reports")
    .select("id, intern_id, report_date, today_work, progress, blockers, tomorrow_plan, status, created_at, updated_at, daily_report_attachments(id, report_id, file_path, file_name, mime_type, size_bytes, created_at), intern_profiles(id, user_id, full_name)")
    .eq("id", reportId);
  if (allowedInternIds !== null) query = query.in("intern_id", allowedInternIds);
  const { data, error } = await query.maybeSingle<any>();
  if (error || !data) return null;
  const internProfile = Array.isArray(data.intern_profiles) ? data.intern_profiles[0] : data.intern_profiles;
  const { data: userProfile } = internProfile ? await db.from("user_profiles").select("full_name").eq("id", internProfile.user_id).maybeSingle() : { data: null };
  return {
    ...data,
    daily_report_attachments: await signAttachments(data.daily_report_attachments),
    intern_profiles: internProfile ? {
      id: internProfile.id,
      user_id: internProfile.user_id,
      user_profiles: { full_name: userProfile?.full_name || internProfile.full_name || "Peserta" },
    } : null,
  } as DailyReportWithIntern;
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
export async function getAdminDailyReports(allowedInternIds: string[] | null, page = 1, limit = 50) {
  if (usesLocalBackend()) {
    if (allowedInternIds !== null && allowedInternIds.length === 0) return { data: [], error: null };
    return { data: await localReports(null, { page, limit, internIds: allowedInternIds ?? undefined }), error: null };
  }
  const db = await createUteroAcademyServiceRoleClient();

  if (allowedInternIds?.length === 0) {
    return { data: [], error: null };
  }

  let query = db
    .from("daily_reports")
    .select("id, intern_id, report_date, today_work, progress, blockers, tomorrow_plan, status, created_at, updated_at, intern_profiles!inner(id, user_id, full_name, status)")
    .order("report_date", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  query = allowedInternIds === null
    ? query.eq("intern_profiles.status", "active")
    : query.in("intern_id", allowedInternIds);
  const { data: reports, error } = await query.returns<any[]>();

  if (error || !reports) {
    return { data: [], error };
  }

  const userIds = [...new Set(reports.map((report) => {
    const profile = Array.isArray(report.intern_profiles) ? report.intern_profiles[0] : report.intern_profiles;
    return profile?.user_id as string | undefined;
  }).filter((id): id is string => !!id))];
  const { data: userProfiles } = userIds.length ? await db.from("user_profiles").select("id, full_name").in("id", userIds) : { data: [] };
  const profilesMap = new Map((userProfiles ?? []).map((profile) => [profile.id, profile]));
  const mappedReports = reports.map((report) => {
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
      daily_report_attachments: [],
      intern_profiles: internProfileArray ? {
        id: internProfileArray.id,
        user_id: internProfileArray.user_id,
        user_profiles: userProfilesData
      } : null
    };
  });

  return { data: mappedReports as DailyReportWithIntern[], error: null };
}

export async function getReportReviews(reportId: string) {
  if (usesLocalBackend()) return { data: await localReviews(reportId), error: null };
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("daily_report_reviews")
    .select("id, report_id, reviewed_by, status, note, created_at")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false })
    .returns<DailyReportReview[]>();

  return { data: data ?? [], error };
}
