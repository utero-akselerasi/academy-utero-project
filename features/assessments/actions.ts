"use server";

import { createSupabaseServerClient, createUteroAcademyServiceRoleClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireAdminUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verifikasi role admin
  const { data: userRole } = await supabase
    .schema("utero_academy")
    .from("user_roles")
    .select("roles(code)")
    .eq("user_id", user.id)
    .maybeSingle();

  const roleObj = Array.isArray(userRole?.roles) ? userRole.roles[0] : userRole?.roles;
  if (roleObj?.code !== "admin") {
    redirect("/login");
  }

  return user;
}

export async function saveAssessmentAction(formData: FormData) {
  const user = await requireAdminUser();
  const internId = formData.get("internId") as string;
  const criteriaNames = formData.getAll("criteriaName") as string[];
  const criteriaScores = formData.getAll("criteriaScore") as string[];
  const feedback = formData.get("feedback") as string;
  const submitType = formData.get("submitType") as "draft" | "finalize";

  if (!internId) throw new Error("Intern ID tidak valid.");

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

  const supabase = createSupabaseServiceRoleClient();
  const ext = file.name.split(".").pop() || "jpg";
  const filePath = "settings/certificate_template_" + Date.now() + "." + ext;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true
    });

  if (uploadError) {
    console.error("Gagal upload template sertifikat:", uploadError);
    throw new Error("Gagal mengunggah template sertifikat.");
  }

  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db.from("attendance_settings").upsert({
    id: "00000000-0000-0000-0000-000000000001",
    certificate_template_path: publicUrl,
    updated_at: new Date().toISOString()
  });

  if (error) {
    console.error("Gagal update template sertifikat di db:", error);
    throw new Error("Gagal menyimpan data template sertifikat.");
  }

  revalidatePath("/dashboard/mentor/assessments");
  revalidatePath("/dashboard/intern/certificate");
}
