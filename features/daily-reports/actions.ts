"use server";

import { requireAdmin, requireUser } from "@/features/auth/guards";
import { HOST_DRIVE_DIIZINKAN, isAllowedDriveLink } from "@/lib/external-links";
import { notifyDailyReportRevisionRequested } from "@/lib/notification";
import { resolveStaffInternScope } from "@/features/auth/scope";
import { createSupabaseServiceRoleClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { UploadValidationError, buildStoragePath, validateUpload } from "@/lib/uploads";
import { revalidatePath } from "next/cache";
import { getMentorProfileId } from "./queries";
import { requireActiveInternProfile } from "@/features/intern/activation";
import { dailyReportSchema, reviewReportSchema } from "./schemas";
import { usesLocalBackend } from "@/lib/backend/mode";
import { localSubmit, localReview } from "./local";

export type DailyReportFormState = {
  ok: boolean;
  message: string;
};

export type ReviewReportState = DailyReportFormState;

export async function submitDailyReportAction(_: DailyReportFormState, formData: FormData): Promise<DailyReportFormState> {
  if (usesLocalBackend()) { await requireUser(); return localSubmit(formData); }
  // Aksi peserta: kepemilikan ditentukan lewat intern_profiles.user_id.
  const user = await requireUser();
  let internProfileId: string;
  try {
    internProfileId = await requireActiveInternProfile(user.id);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Fitur magang belum aktif." };
  }
  if (!internProfileId) {
    return { ok: false, message: "Profil peserta belum ditemukan. Hubungi admin." };
  }
  const parsed = dailyReportSchema.safeParse({
    reportDate: formData.get("reportDate"),
    todayWork: formData.get("todayWork"),
    progress: formData.get("progress") || undefined,
    blockers: formData.get("blockers") || undefined,
    tomorrowPlan: formData.get("tomorrowPlan") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data laporan tidak valid." };
  }
  
  const googleDriveLink = formData.get("googleDriveLink") as string;
  const files = formData.getAll("attachment") as File[];
  const reportId = formData.get("reportId") as string;
  if (files.filter((file) => file.size > 0).length > 10) {
    return { ok: false, message: "Maksimal 10 lampiran per laporan." };
  }

  let attachments;
  try {
    attachments = await Promise.all(files.filter((file) => file.size > 0).map((file) => validateUpload(file, ["image", "document"])));
  } catch (error) {
    if (error instanceof UploadValidationError) return { ok: false, message: `Lampiran ditolak: ${error.message}` };
    console.error("Gagal memvalidasi lampiran daily-report:", error);
    return { ok: false, message: "Lampiran tidak dapat diproses." };
  }
  


  const db = await createUteroAcademyServiceRoleClient();
  let reportData;
  let error;

  if (reportId) {
    // Mode Edit / Revisi
    const { data: existingReport } = await db
      .from("daily_reports")
      .select("status")
      .eq("id", reportId)
      .eq("intern_id", internProfileId)
      .maybeSingle();

    if (!existingReport) {
      return { ok: false, message: "Laporan tidak ditemukan." };
    }

    const { data, error: updateError } = await db
      .from("daily_reports")
      .update({
        today_work: parsed.data.todayWork,
        progress: parsed.data.progress || null,
        blockers: parsed.data.blockers || null,
        tomorrow_plan: parsed.data.tomorrowPlan || null,
        status: "submitted", // Reset status ke submitted agar mentor mereview kembali
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId)
      .select("id")
      .maybeSingle();
      
    reportData = data;
    error = updateError;
  } else {
    // Mode Baru
    const { data, error: insertError } = await db
      .from("daily_reports")
      .insert({
        intern_id: internProfileId,
        report_date: parsed.data.reportDate,
        today_work: parsed.data.todayWork,
        progress: parsed.data.progress || null,
        blockers: parsed.data.blockers || null,
        tomorrow_plan: parsed.data.tomorrowPlan || null,
        status: "submitted",
      })
      .select("id")
      .maybeSingle();
      
    reportData = data;
    error = insertError;
  }
  
  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "Laporan untuk tanggal ini sudah pernah dikirim." };
    }
    console.error("Gagal submit daily report:", error);
    return { ok: false, message: "Laporan belum berhasil disimpan. Coba lagi." };
  }
  
  const finalReportId = reportData?.id;
  if (!finalReportId) {
    return { ok: false, message: "Laporan gagal disimpan." };
  }

  // Upload file-file lampiran ke storage Supabase.
  // Tipe/ekstensi/MIME diambil dari isi berkas, bukan dari klien.
  if (attachments.length > 0) {
    const serviceRoleSupabase = createSupabaseServiceRoleClient();
    const uploaded = await Promise.all(attachments.map(async (attachment) => {
      const filePath = buildStoragePath(finalReportId, attachment.ext);
      const { error: uploadError } = await serviceRoleSupabase.storage
        .from("daily-report")
        .upload(filePath, attachment.buffer, { contentType: attachment.contentType, upsert: false });
      if (uploadError) {
        console.error("Gagal upload attachment daily-report:", uploadError);
        return null;
      }
      return { report_id: finalReportId, file_path: filePath, file_name: attachment.displayName,
        mime_type: attachment.contentType, size_bytes: attachment.size };
    }));
    const rows = uploaded.filter((item): item is NonNullable<typeof item> => item !== null);
    if (rows.length > 0) await db.from("daily_report_attachments").insert(rows);
  }

  // Link Google Drive disimpan sebagai attachment ber-`mime_type: "url"`.
  //
  // Pemeriksaannya dulu `googleDriveLink.includes("google.com")`, yang bukan
  // pemeriksaan host sama sekali: `http://google.com.penyerang.net/muatan`,
  // `https://jahat.com/?x=google.com`, dan `javascript:alert(1)//google.com`
  // semuanya lolos dan tersimpan — lalu dirender sebagai tautan yang **diklik
  // pembimbing** saat mereview. Itu jalur phishing ke akun berhak lebih tinggi
  // daripada pengirimnya. Sekarang lewat `isAllowedDriveLink()`.
  if (googleDriveLink) {
    // Ditolak dengan pesan, bukan dibuang diam-diam. Bentuk lama membiarkan
    // cabang `if` gagal tanpa suara, jadi peserta yang salah menempel link
    // melihat laporannya "berhasil" padahal lampirannya tidak pernah ada.
    if (!isAllowedDriveLink(googleDriveLink)) {
      return {
        ok: false,
        message: `Link lampiran harus URL https dari ${HOST_DRIVE_DIIZINKAN.join(" atau ")}.`,
      };
    }

    await db.from("daily_report_attachments").insert({
      report_id: finalReportId,
      file_path: googleDriveLink,
      file_name: "Link Google Drive",
      mime_type: "url",
      size_bytes: null
    });
  }

  revalidatePath("/dashboard/intern/daily-reports");
  return { ok: true, message: reportId ? "Laporan harian berhasil diperbarui." : "Laporan harian berhasil dikirim." };
}

export async function reviewDailyReportAction(_: ReviewReportState, formData: FormData): Promise<ReviewReportState> {
  if (usesLocalBackend()) { await requireAdmin(); return localReview(formData); }
  // Review laporan adalah pekerjaan staff. Guard lama hanya mengandalkan
  // keberadaan mentor_profiles, yang bukan bukti otorisasi.
  const user = await requireAdmin();
  const mentorProfileId = await getMentorProfileId(user.id);
  if (!mentorProfileId) {
    return { ok: false, message: "Profil pembimbing belum disiapkan. Hubungi super admin." };
  }
  const parsed = reviewReportSchema.safeParse({
    reportId: formData.get("reportId"),
    status: formData.get("status"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Data review tidak valid." };
  }
  const db = await createUteroAcademyServiceRoleClient();

  // Admin hanya boleh mereview laporan intern yang dibimbingnya.
  const { data: targetReport, error: targetError } = await db
    .from("daily_reports")
    .select("id, intern_id")
    .eq("id", parsed.data.reportId)
    .maybeSingle();

  if (targetError) {
    console.error("Gagal membaca daily report:", targetError);
    return { ok: false, message: "Gagal memverifikasi data laporan." };
  }
  if (!targetReport) {
    return { ok: false, message: "Laporan tidak ditemukan." };
  }

  const scope = await resolveStaffInternScope(user.id);
  if (scope.kind === "setup_required") {
    return { ok: false, message: "Profil pembimbing belum disiapkan. Hubungi super admin." };
  }
  if (scope.kind === "scoped" && !scope.internIds.includes(targetReport.intern_id as string)) {
    return { ok: false, message: "Kamu tidak membimbing peserta ini." };
  }

  const { error: reviewError } = await db.from("daily_report_reviews").insert({
    report_id: parsed.data.reportId,
    mentor_id: mentorProfileId,
    status: parsed.data.status,
    note: parsed.data.note || null,
  });
  if (reviewError) {
    console.error("Gagal insert review:", reviewError);
    return { ok: false, message: "Review belum berhasil disimpan." };
  }
  const { error: updateError } = await db.from("daily_reports").update({
    status: parsed.data.status,
    updated_at: new Date().toISOString(),
  }).eq("id", parsed.data.reportId);
  if (updateError) {
    console.error("Gagal update status report:", updateError);
    return { ok: false, message: "Status laporan belum berhasil diperbarui." };
  }

  // Notifikasi revisi jika diminta
  if (parsed.data.status === "revision_requested") {
    try {
      const { data: report } = await db
        .from("daily_reports")
        .select("report_date, intern_profiles(full_name, email, phone)")
        .eq("id", parsed.data.reportId)
        .maybeSingle();

      if (report) {
        const intern = Array.isArray(report.intern_profiles) ? report.intern_profiles[0] : report.intern_profiles;
        if (intern) {
          await notifyDailyReportRevisionRequested(
            intern.email,
            intern.phone,
            intern.full_name,
            report.report_date,
            parsed.data.note || "Revisi diminta"
          );
        }
      }
    } catch (err) {
      console.error("Gagal mengirim notifikasi revisi daily report:", err);
    }
  }

  revalidatePath("/dashboard/admin/daily-reports");
  return { ok: true, message: "Review berhasil disimpan." };
}
