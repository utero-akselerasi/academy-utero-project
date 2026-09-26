"use server";

import { requireAdmin } from "@/features/auth/guards";
import { resolveStaffInternScope } from "@/features/auth/scope";
import { createUteroAcademyServiceRoleClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { UploadValidationError, buildStoragePath, validateUpload } from "@/lib/uploads";
import { revalidatePath } from "next/cache";

// Guard terpusat: cek role lewat semua baris user_roles dan izinkan super_admin.
// Guard lama pakai maybeSingle() sehingga user multi-role gagal.
const requireAdminUser = requireAdmin;

export async function saveAssessmentAction(formData: FormData) {
  const user = await requireAdminUser();
  const internId = formData.get("internId") as string;
  const criteriaNames = formData.getAll("criteriaName") as string[];
  const criteriaScores = formData.getAll("criteriaScore") as string[];
  const feedback = formData.get("feedback") as string;
  const submitType = formData.get("submitType") as "draft" | "finalize";

  if (!internId) throw new Error("Intern ID tidak valid.");

  // Admin hanya boleh menilai intern yang memang dibimbingnya (mentor_assignments
  // aktif). super_admin bebas. Tanpa ini, admin mana pun bisa menilai dan
  // menerbitkan sertifikat untuk intern siapa pun lewat action ID.
  const scope = await resolveStaffInternScope(user.id);
  if (scope.kind === "setup_required") {
    throw new Error("Profil pembimbing belum disiapkan. Hubungi super admin.");
  }
  if (scope.kind === "scoped" && !scope.internIds.includes(internId)) {
    throw new Error("Kamu tidak membimbing peserta ini, jadi tidak bisa menilainya.");
  }

  let scoreJson: Record<string, number> = {};
  let totalScore = 0;

  if (criteriaNames.length > 0) {
    criteriaNames.forEach((name, idx) => {
      const scoreVal = parseFloat(criteriaScores[idx] || "0");
      if (scoreVal < 0 || scoreVal > 100) {
        throw new Error("Setiap nilai kriteria harus antara 0 s.d. 100.");
      }
      scoreJson[name] = scoreVal;
      totalScore += scoreVal;
    });
  } else {
    const technical = parseFloat(formData.get("technical") as string || "0");
    const discipline = parseFloat(formData.get("discipline") as string || "0");
    const attitude = parseFloat(formData.get("attitude") as string || "0");
    if (technical < 0 || technical > 100 || discipline < 0 || discipline > 100 || attitude < 0 || attitude > 100) {
      throw new Error("Nilai harus berupa angka antara 0 s.d. 100.");
    }
    scoreJson = { technical, discipline, attitude };
    totalScore = technical + discipline + attitude;
  }

  const numCriteria = Object.keys(scoreJson).length || 3;
  const finalScore = Math.round((totalScore / numCriteria) * 100) / 100;

  const db = await createUteroAcademyServiceRoleClient();

  // Dapatkan profil pembimbing/mentor dari user login admin
  const { data: mentorProfile } = await db
    .from("mentor_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const mentorId = mentorProfile?.id || null;

  // Cek apakah assessment sudah ada
  const { data: existing } = await db
    .from("assessments")
    .select("id, status")
    .eq("intern_id", internId)
    .maybeSingle();

  if (existing && existing.status === "finalized") {
    throw new Error("Penilaian sudah difinalisasi dan tidak dapat diubah lagi.");
  }

  let assessmentId = existing?.id;

  if (existing) {
    // Update
    const updateData: any = {
      score: scoreJson,
      final_score: finalScore,
      feedback: feedback || null,
      updated_at: new Date().toISOString()
    };

    if (submitType === "finalize") {
      updateData.status = "finalized";
      updateData.finalized_by = user.id;
      updateData.finalized_at = new Date().toISOString();
    }

    const { error } = await db
      .from("assessments")
      .update(updateData)
      .eq("id", existing.id);

    if (error) {
      console.error("Gagal update assessment:", error);
      throw new Error("Gagal menyimpan penilaian.");
    }
  } else {
    // Insert baru
    const insertData: any = {
      intern_id: internId,
      mentor_id: mentorId,
      score: scoreJson,
      final_score: finalScore,
      feedback: feedback || null,
      status: submitType === "finalize" ? "finalized" : "draft"
    };

    if (submitType === "finalize") {
      insertData.finalized_by = user.id;
      insertData.finalized_at = new Date().toISOString();
    }

    const { data: newAss, error } = await db
      .from("assessments")
      .insert(insertData)
      .select("id")
      .maybeSingle();

    if (error || !newAss) {
      console.error("Gagal insert assessment:", error);
      throw new Error("Gagal menyimpan penilaian baru.");
    }
    assessmentId = newAss.id;
  }

  // Jika di-finalize, terbitkan sertifikat otomatis
  if (submitType === "finalize" && assessmentId) {
    const year = new Date().getFullYear();
    const randomNumber = Math.floor(1000 + Math.random() * 9000);
    const certNumber = `CERT/UA/${year}/${randomNumber}`;

    const { error: certErr } = await db
      .from("certificates")
      .insert({
        assessment_id: assessmentId,
        intern_id: internId,
        certificate_number: certNumber,
        status: "issued",
        issued_at: new Date().toISOString(),
        signed_at: new Date().toISOString()
      });

    if (certErr && certErr.code !== "23505") {
      console.error("Gagal terbitkan sertifikat:", certErr);
      throw new Error("Penilaian disimpan, namun gagal menerbitkan sertifikat otomatis.");
    }
  }

  revalidatePath("/dashboard/mentor/assessments");
  revalidatePath("/dashboard/intern/certificate");
  revalidatePath("/dashboard/school");
}


export async function uploadCertificateTemplateAction(formData: FormData) {
  const user = await requireAdminUser();
  const file = formData.get("templateFile") as File;

  if (!file || file.size === 0) {
    throw new Error("File template wajib diunggah.");
  }

  // Template sertifikat adalah gambar; tipe & ekstensi dari isi berkas.
  let template;
  try {
    template = await validateUpload(file, ["image"]);
  } catch (error) {
    if (error instanceof UploadValidationError) throw new Error(error.message);
    console.error("Gagal memvalidasi template sertifikat:", error);
    throw new Error("Template sertifikat tidak dapat diproses.");
  }

  const supabase = createSupabaseServiceRoleClient();
  const filePath = buildStoragePath("settings", template.ext);

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, template.buffer, {
      contentType: template.contentType,
      upsert: false
    });

  if (uploadError) {
    console.error("Gagal upload template sertifikat:", uploadError);
    throw new Error("Gagal mengunggah template sertifikat.");
  }

  // Object path, bukan URL publik. Dibaca lewat `resolveStorageUrl("avatars", …)`
  // di `features/assessments/queries.ts` dan di halaman cetak sertifikat.
  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db.from("attendance_settings").upsert({
    id: "00000000-0000-0000-0000-000000000001",
    certificate_template_path: filePath,
    updated_at: new Date().toISOString()
  });

  if (error) {
    console.error("Gagal update template sertifikat di db:", error);
    throw new Error("Gagal menyimpan data template sertifikat.");
  }

  revalidatePath("/dashboard/mentor/assessments");
  revalidatePath("/dashboard/intern/certificate");
}
