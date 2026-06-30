import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";

export async function getInternsForAssessment() {
  const db = await createUteroAcademyServiceRoleClient();

  // Ambil semua anak magang aktif
  const { data: interns, error: internErr } = await db
    .from("intern_profiles")
    .select("id, full_name, email, major, status")
    .eq("status", "active")
    .order("full_name", { ascending: true });

  if (internErr || !interns) {
    return { data: [], error: internErr };
  }

  // Ambil semua assessments
  const { data: assessments } = await db
    .from("assessments")
    .select("id, intern_id, final_score, status, feedback, score");

  const assessmentMap = new Map();
  if (assessments) {
    assessments.forEach(a => assessmentMap.set(a.intern_id, a));
  }

  // Gabungkan data
  const mapped = interns.map(i => {
    const ass = assessmentMap.get(i.id);
    return {
      ...i,
      assessment: ass ? {
        id: ass.id,
        final_score: ass.final_score,
        status: ass.status,
        feedback: ass.feedback,
        score: ass.score
      } : null
    };
  });

  return { data: mapped, error: null };
}

export async function getInternAssessment(internProfileId: string) {
  const db = await createUteroAcademyServiceRoleClient();

  const { data, error } = await db
    .from("assessments")
    .select("id, intern_id, final_score, feedback, status, score, created_at, updated_at")
    .eq("intern_id", internProfileId)
    .maybeSingle();

  return { data, error };
}

export async function getInternCertificate(internProfileId: string) {
  const db = await createUteroAcademyServiceRoleClient();

  const { data, error } = await db
    .from("certificates")
    .select("id, intern_id, certificate_number, file_path, status, issued_at, signed_at, assessments(id, final_score, feedback, score)")
    .eq("intern_id", internProfileId)
    .maybeSingle();

  if (error || !data) {
    return { data: null, error };
  }

  const ass = Array.isArray(data.assessments) ? data.assessments[0] : data.assessments;
  return {
    data: {
      id: data.id,
      intern_id: data.intern_id,
      certificate_number: data.certificate_number,
      file_path: data.file_path,
      status: data.status,
      issued_at: data.issued_at,
      signed_at: data.signed_at,
      assessment: ass
    },
    error: null
  };
}
