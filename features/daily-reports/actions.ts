"use server";

import { requireAdmin, requireUser } from "@/features/auth/guards";
import { resolveStaffInternScope } from "@/features/auth/scope";
import { createSupabaseServiceRoleClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { UploadValidationError, buildStoragePath, validateUpload } from "@/lib/uploads";
import { revalidatePath } from "next/cache";
import { getInternProfileId, getMentorProfileId } from "./queries";
import { dailyReportSchema, reviewReportSchema } from "./schemas";

export type DailyReportFormState = {
  ok: boolean;
  message: string;
};

export async function submitDailyReportAction(_: DailyReportFormState, formData: FormData): Promise<DailyReportFormState> {
  // Aksi peserta: kepemilikan ditentukan lewat intern_profiles.user_id.
  const user = await requireUser();
  const internProfileId = await getInternProfileId(user.id);
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
  for (const file of files) {
    if (file && file.size > 0) {
      let attachment;
      try {
        attachment = await validateUpload(file, ["image", "document"]);
      } catch (error) {
        if (error instanceof UploadValidationError) {
          return { ok: false, message: `Lampiran ditolak: ${error.message}` };
        }
        console.error("Gagal memvalidasi lampiran daily-report:", error);
        return { ok: false, message: "Lampiran tidak dapat diproses." };
      }

      const filePath = buildStoragePath(finalReportId, attachment.ext);
      const serviceRoleSupabase = createSupabaseServiceRoleClient();
      const { error: uploadError } = await serviceRoleSupabase.storage
        .from("daily-report")
        .upload(filePath, attachment.buffer, { contentType: attachment.contentType, upsert: false });
      if (uploadError) {
        console.error("Gagal upload attachment daily-report:", uploadError);
      } else {
        // Object path, bukan URL publik. `daily-report` memang sudah privat di
        // seed `0002_storage_buckets.sql` — 0007 yang memaksanya publik. Setelah
        // 0032a mengembalikannya, URL publik di kolom ini akan mati, jadi
        // pembacaannya lewat `resolveStorageUrl()` di `queries.ts`.
        await db.from("daily_report_attachments").insert({
          report_id: finalReportId,
          file_path: filePath,
          file_name: attachment.displayName,
          mime_type: attachment.contentType,
          size_bytes: attachment.size
        });
      }
    }
  }

  // Jika ada Google Drive link, masukkan juga ke daily_report_attachments
  if (googleDriveLink && (googleDriveLink.includes("google.com") || googleDriveLink.includes("drive.google.com"))) {
    await db.from("daily_report_attachments").insert({
      report_id: finalReportId,
      file_path: googleDriveLink,
      file_name: "Link Google Drive",
      mime_type: "url",
      size_bytes: null
    });
  }

  // === OTOMATISASI TASK BOARD DARI DAILY TASK ===
  try {
    const { data: assignment } = await db
      .from("mentor_assignments")
      .select("mentor_id, mentor_profiles(user_id)")
      .eq("intern_id", internProfileId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (assignment) {
      const mentorProfilesArray = Array.isArray(assignment.mentor_profiles) ? assignment.mentor_profiles[0] : assignment.mentor_profiles;
      const mentorUserId = mentorProfilesArray?.user_id;
      
      if (mentorUserId) {
        // Ambil nama intern
        const { data: internProfile } = await db
          .from("intern_profiles")
          .select("full_name")
          .eq("id", internProfileId)
          .maybeSingle();
        const internName = internProfile?.full_name || "Peserta Magang";
        const cardTitle = "Laporan Harian - " + parsed.data.reportDate + " - " + internName;

        let cardDesc = "Pekerjaan Hari Ini: " + parsed.data.todayWork;
        if (parsed.data.progress) cardDesc += "\nProgress: " + parsed.data.progress;
        if (parsed.data.blockers) cardDesc += "\nKendala: " + parsed.data.blockers;
        if (googleDriveLink) cardDesc += "\nGoogle Drive Link: " + googleDriveLink;

        if (reportId) {
          // Edit: Update deskripsi card otomatis yang sudah ada
          await db
            .from("task_cards")
            .update({
              description: cardDesc,
              updated_at: new Date().toISOString()
            })
            .eq("intern_id", internProfileId)
            .eq("title", cardTitle);
        } else {
          // Baru: Tambahkan card baru ke list pertama di board mentor
          const { data: existingBoards } = await db
            .from("task_boards")
            .select("id")
            .eq("owner_id", mentorUserId)
            .order("created_at", { ascending: true })
            .limit(1);

          let boardId = existingBoards && existingBoards.length > 0 ? existingBoards[0].id : null;

          if (!boardId) {
            const { data: newBoard } = await db
              .from("task_boards")
              .insert({
                name: "Board Bimbingan Magang",
                description: "Board otomatis untuk melacak tugas bimbingan magang.",
                owner_id: mentorUserId
              })
              .select("id")
              .maybeSingle();
            boardId = newBoard?.id;
          }

          if (boardId) {
            let { data: lists } = await db
              .from("task_lists")
              .select("id")
              .eq("board_id", boardId)
              .order("order_index", { ascending: true });

            let listId = lists && lists.length > 0 ? lists[0].id : null;

            if (!listId) {
              const { data: newList } = await db
                .from("task_lists")
                .insert({
                  board_id: boardId,
                  name: "Laporan Harian",
                  order_index: 0
                })
                .select("id")
                .maybeSingle();
              listId = newList?.id;
            }

            if (listId) {
              const { data: maxOrder } = await db
                .from("task_cards")
                .select("order_index")
                .eq("list_id", listId)
                .order("order_index", { ascending: false })
                .limit(1)
                .maybeSingle();

              const nextOrder = (maxOrder?.order_index ?? -1) + 1;

              await db.from("task_cards").insert({
                list_id: listId,
                title: cardTitle,
                description: cardDesc,
                intern_id: internProfileId,
                mentor_id: assignment.mentor_id,
                order_index: nextOrder,
                created_by: user.id
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Gagal otomatisasi task board:", err);
  }

  revalidatePath("/dashboard/intern/daily-reports");
  return { ok: true, message: reportId ? "Laporan harian berhasil diperbarui." : "Laporan harian berhasil dikirim." };
}

export async function reviewDailyReportAction(formData: FormData) {
  // Review laporan adalah pekerjaan staff. Guard lama hanya mengandalkan
  // keberadaan mentor_profiles, yang bukan bukti otorisasi.
  const user = await requireAdmin();
  const mentorProfileId = await getMentorProfileId(user.id);
  if (!mentorProfileId) {
    throw new Error("Profil pembimbing belum disiapkan. Hubungi super admin.");
  }
  const parsed = reviewReportSchema.safeParse({
    reportId: formData.get("reportId"),
    status: formData.get("status"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    throw new Error("Data review tidak valid.");
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
    throw new Error("Gagal memverifikasi data laporan.");
  }
  if (!targetReport) {
    throw new Error("Laporan tidak ditemukan.");
  }

  const scope = await resolveStaffInternScope(user.id);
  if (scope.kind === "setup_required") {
    throw new Error("Profil pembimbing belum disiapkan. Hubungi super admin.");
  }
  if (scope.kind === "scoped" && !scope.internIds.includes(targetReport.intern_id as string)) {
    throw new Error("Kamu tidak membimbing peserta ini.");
  }

  const { error: reviewError } = await db.from("daily_report_reviews").insert({
    report_id: parsed.data.reportId,
    mentor_id: mentorProfileId,
    status: parsed.data.status,
    note: parsed.data.note || null,
  });
  if (reviewError) {
    console.error("Gagal insert review:", reviewError);
    throw new Error("Review belum berhasil disimpan.");
  }
  const { error: updateError } = await db.from("daily_reports").update({
    status: parsed.data.status,
    updated_at: new Date().toISOString(),
  }).eq("id", parsed.data.reportId);
  if (updateError) {
    console.error("Gagal update status report:", updateError);
    throw new Error("Status laporan belum berhasil diperbarui.");
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
          const { notifyDailyReportRevisionRequested } = require("@/lib/notification");
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

  revalidatePath("/dashboard/mentor/daily-reports");
}
