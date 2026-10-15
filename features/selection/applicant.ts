import { requireApplicant } from "@/features/auth/guards";
import { backendRequest, usesLocalBackend } from "@/lib/backend/server";
import { createUteroAcademyClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";

type ApplicantSelectionData = {
  applications: Array<{ id: string; full_name: string; selection_status: string | null; selection_track_id: string | null }>;
  assignments: Array<{ id: string; application_id: string; package_id: string; status: string; due_at: string | null; max_attempts: number }>;
  packages: Array<{ id: string; title: string; description: string | null; track_id: string; duration_minutes: number; available_from: string | null; available_until: string | null; is_published: boolean }>;
  attempts: Array<{ id: string; assignment_id: string; status: string; expires_at: string | null; attempt_number: number }>;
  materials: Array<{ id: string; track_id: string; title: string; content: unknown; order_index: number }>;
  results: Array<{ applicationId: string; rows: Array<{ decision_id: string; application_id: string; result: string; final_score: number | null; public_note: string | null }> }>;
  currentTime: number;
};

type ApplicantAttemptData = {
  assignment: { id: string; application_id: string; package_id: string; status: string; due_at: string | null; max_attempts: number };
  test: { id: string; title: string; description: string | null; duration_minutes: number; is_published: boolean; available_from: string | null; available_until: string | null };
  attempt: { id: string; status: string; expires_at: string | null; attempt_number: number } | null;
  questions: Array<{ id: string; question_type: string; prompt: { text?: string }; points: number; order_index: number; is_required: boolean }>;
  options: Array<{ id: string; question_id: string; label: string; content: unknown; order_index: number }>;
  answers: Array<{ question_id: string; selected_option_ids: string[]; answer_text: string | null; attachment_path: string | null }>;
  active: boolean;
};

export async function getApplicantSelection(): Promise<ApplicantSelectionData> {
  const user = await requireApplicant();
  if (usesLocalBackend()) {
    const response = await backendRequest("/v1/registration/selection");
    if (!response.ok) throw new Error("Gagal memuat seleksi dari backend lokal.");
    return response.json() as Promise<ApplicantSelectionData>;
  }
  const db = await createUteroAcademyServiceRoleClient();
  const { data: applications, error } = await db.from("internship_applications").select("id,full_name,selection_status,selection_track_id").eq("applicant_user_id", user.id);
  if (error) throw new Error(error.message);
  const applicationIds = (applications ?? []).map((application) => application.id);
  const { data: assignments, error: assignmentError } = applicationIds.length
    ? await db.from("selection_assignments").select("id,application_id,package_id,status,due_at,max_attempts").in("application_id", applicationIds)
    : { data: [], error: null };
  if (assignmentError) throw new Error(assignmentError.message);
  const packageIds = (assignments ?? []).map((assignment) => assignment.package_id);
  const packages = packageIds.length ? await db.from("selection_test_packages").select("id,title,description,track_id,duration_minutes,available_from,available_until,is_published").in("id", packageIds) : { data: [], error: null };
  if (packages.error) throw new Error(packages.error.message);
  const attempts = (assignments ?? []).length ? await db.from("selection_attempts").select("id,assignment_id,status,expires_at,attempt_number").in("assignment_id", assignments!.map((assignment) => assignment.id)).eq("applicant_user_id", user.id).order("attempt_number", { ascending: false }) : { data: [], error: null };
  if (attempts.error) throw new Error(attempts.error.message);
  const trackIds = [...new Set((applications ?? []).map((application) => application.selection_track_id).filter((track): track is string => !!track))];
  const materials = trackIds.length ? await db.from("selection_materials").select("id,track_id,title,content,order_index").in("track_id", trackIds).eq("is_published", true).order("order_index") : { data: [], error: null };
  if (materials.error) throw new Error(materials.error.message);
  const sessionDb = await createUteroAcademyClient();
  const results = await Promise.all(applicationIds.map(async (applicationId) => {
    const { data, error: resultError } = await sessionDb.rpc("visible_selection_results", { p_application_id: applicationId });
    if (resultError) throw new Error(resultError.message);
    return { applicationId, rows: data ?? [] };
  }));
  return { applications: applications ?? [], assignments: assignments ?? [], packages: packages.data ?? [], attempts: attempts.data ?? [], materials: materials.data ?? [], results, currentTime: Date.now() };
}

export async function getApplicantAttempt(assignmentId: string): Promise<ApplicantAttemptData> {
  const user = await requireApplicant();
  if (usesLocalBackend()) {
    const response = await backendRequest(`/v1/registration/selection/${encodeURIComponent(assignmentId)}`);
    if (response.status === 404) throw new Error("Tes tidak ditemukan.");
    if (!response.ok) throw new Error("Gagal memuat tes dari backend lokal.");
    return response.json() as Promise<ApplicantAttemptData>;
  }
  const db = await createUteroAcademyServiceRoleClient();
  const { data: assignment } = await db.from("selection_assignments").select("id,application_id,package_id,status,due_at,max_attempts").eq("id", assignmentId).single();
  if (!assignment) throw new Error("Tes tidak ditemukan.");
  const { data: application } = await db.from("internship_applications").select("applicant_user_id").eq("id", assignment.application_id).single();
  if (application?.applicant_user_id !== user.id) throw new Error("Akses tes ditolak.");
  const { data: test } = await db.from("selection_test_packages").select("id,title,description,duration_minutes,is_published,available_from,available_until").eq("id", assignment.package_id).single();
  if (!test?.is_published) throw new Error("Tes tidak tersedia.");
  const { data: attempt } = await db.from("selection_attempts").select("id,status,expires_at,attempt_number").eq("assignment_id", assignment.id).eq("applicant_user_id", user.id).order("attempt_number", { ascending: false }).limit(1).maybeSingle();
  const currentTime = Date.now();
  const active = attempt?.status === "in_progress" && !!attempt.expires_at && currentTime < Date.parse(attempt.expires_at) && (!assignment.due_at || currentTime < Date.parse(assignment.due_at));
  if (!active) return { assignment, test, attempt, questions: [] as Array<{ id: string; question_type: string; prompt: { text?: string }; points: number; order_index: number; is_required: boolean }>, options: [] as Array<{ id: string; question_id: string; label: string; content: unknown; order_index: number }>, answers: [] as Array<{ question_id: string; selected_option_ids: string[]; answer_text: string | null; attachment_path: string | null }>, active: false };
  const { data: questions, error } = await db.from("selection_questions").select("id,question_type,prompt,points,order_index,is_required").eq("package_id", test.id).order("order_index");
  if (error) throw new Error(error.message);
  const questionIds = (questions ?? []).map((question) => question.id);
  const options = questionIds.length ? await db.from("selection_question_options").select("id,question_id,label,content,order_index").in("question_id", questionIds).order("order_index") : { data: [], error: null };
  if (options.error) throw new Error(options.error.message);
  const answers = attempt ? await db.from("selection_answers").select("question_id,selected_option_ids,answer_text,attachment_path").eq("attempt_id", attempt.id) : { data: [], error: null };
  if (answers.error) throw new Error(answers.error.message);
  return { assignment, test, attempt, questions: questions ?? [], options: options.data ?? [], answers: answers.data ?? [], active };
}
