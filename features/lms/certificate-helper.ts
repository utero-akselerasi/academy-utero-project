"use server";

import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";

export async function generateCourseCertificate(internProfileId: string, courseId: string) {
  const db = await createUteroAcademyServiceRoleClient();

  // Cek apakah sudah ada sertifikat untuk course ini
  const { data: existing } = await db
    .from("certificates")
    .select("id")
    .eq("intern_id", internProfileId)
    .eq("course_id", courseId)
    .eq("certificate_type", "course_completion")
    .maybeSingle();

  if (existing) {
    return; // Sudah ada sertifikat, skip
  }

  // Generate nomor sertifikat unik
  const year = new Date().getFullYear();
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  const certificateNumber = `CERT/LMS/${year}/${randomDigits}`;

  // Get course info
  const { data: course } = await db
    .from("courses")
    .select("title")
    .eq("id", courseId)
    .maybeSingle();

  const { error } = await db.from("certificates").insert({
    intern_id: internProfileId,
    course_id: courseId,
    certificate_type: "course_completion",
    certificate_number: certificateNumber,
    final_score: 100, // Course completion = 100%
    status: "issued",
    issued_at: new Date().toISOString(),
    signed_at: new Date().toISOString(),
    notes: `Menyelesaikan course: ${course?.title || "Unknown Course"}`
  });

  if (error) {
    console.error("Gagal generate course certificate:", error);
    // Don't throw error, just log it
  }
}
