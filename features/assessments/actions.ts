"use server";

import { createSupabaseServerClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
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
  const technical = parseFloat(formData.get("technical") as string || "0");
  const discipline = parseFloat(formData.get("discipline") as string || "0");
  const attitude = parseFloat(formData.get("attitude") as string || "0");
  const feedback = formData.get("feedback") as string;
  const submitType = formData.get("submitType") as "draft" | "finalize"; // 'draft' atau 'finalize'

  if (!internId) throw new Error("Intern ID tidak valid.");
  if (technical < 0 || technical > 100 || discipline < 0 || discipline > 100 || attitude < 0 || attitude > 100) {
    throw new Error("Nilai harus berupa angka antara 0 s.d. 100.");
  }

  const finalScore = Math.round(((technical + discipline + attitude) / 3) * 100) / 100;
  const scoreJson = {
    technical,
    discipline,
    attitude
  };

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
