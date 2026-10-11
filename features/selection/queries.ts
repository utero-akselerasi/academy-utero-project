import { requireAdmin, requireSuperAdmin } from "@/features/auth/guards";
import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import type { SelectionWorkspace, SelectionAssignmentReview } from "./types";

export async function getSelectionWorkspace(): Promise<SelectionWorkspace> {
  await requireAdmin();
  const db = await createUteroAcademyServiceRoleClient();
  const [tracks, materials, tests, questions, applications, assignments] = await Promise.all([
    db.from("selection_tracks").select("id,name,code,description,is_active").order("name"),
    db.from("selection_materials").select("id,track_id,title,content,attachment_path,order_index,is_published").order("order_index"),
    db.from("selection_test_packages").select("id,code,track_id,title,description,version,passing_score,duration_minutes,max_attempts,is_published").order("title"),
    db.from("selection_questions").select("id,package_id,question_type,prompt,points,order_index,answer_key,options:selection_question_options(id,question_id,label,is_correct,order_index)").order("order_index"),
    db.from("internship_applications").select("id,full_name,email,major,selection_status").order("created_at", { ascending: false }).limit(200),
    db.from("selection_assignments").select("id,application_id,package_id,status,assigned_at,due_at").order("assigned_at", { ascending: false }).limit(200),
  ]);
  for (const result of [tracks, materials, tests, questions, applications, assignments]) {
    if (result.error) throw new Error(`Gagal membaca data seleksi: ${result.error.message}`);
  }
  const assignmentRows = assignments.data ?? [];
  const assignmentIds = assignmentRows.map((row) => row.id);
  const attempts = assignmentIds.length
    ? await db.from("selection_attempts").select("id,assignment_id,status,final_score,submitted_at").in("assignment_id", assignmentIds).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (attempts.error) throw new Error(attempts.error.message);
  const attemptIds = (attempts.data ?? []).map((row) => row.id);
  const answers = attemptIds.length
    ? await db.from("selection_answers").select("id,attempt_id,question_id,answer_text,attachment_path,manual_score").in("attempt_id", attemptIds)
    : { data: [], error: null };
  if (answers.error) throw new Error(answers.error.message);
  const applicationsById = new Map((applications.data ?? []).map((item) => [item.id, item]));
  const testsById = new Map((tests.data ?? []).map((item) => [item.id, item]));
  const questionsById = new Map((questions.data ?? []).map((item) => [item.id, item]));
  const reviews: SelectionAssignmentReview[] = assignmentRows.map((row) => {
    const attempt = (attempts.data ?? []).find((item) => item.assignment_id === row.id);
    const applicant = applicationsById.get(row.application_id);
    const test = testsById.get(row.package_id);
    return {
      ...row,
      status: row.status as SelectionAssignmentReview["status"],
      applicant: applicant ? { full_name: applicant.full_name, email: applicant.email, major: applicant.major } : null,
      test: test ? { title: test.title, passing_score: test.passing_score, version: test.version } : null,
      attempt: attempt ? {
        id: attempt.id, status: attempt.status, final_score: attempt.final_score, submitted_at: attempt.submitted_at,
        answers: (answers.data ?? []).filter((answer) => answer.attempt_id === attempt.id).map((answer) => {
          const question = questionsById.get(answer.question_id);
          return { ...answer, feedback: null, question: question ? { prompt: (question.prompt as { text?: string })?.text ?? "Pertanyaan", type: question.question_type as "essay", points: question.points } : null };
        }),
      } : null,
    };
  });
  return {
    tracks: tracks.data ?? [], materials: materials.data ?? [], tests: tests.data ?? [],
    questions: (questions.data ?? []) as SelectionWorkspace["questions"],
    applications: applications.data ?? [], assignments: reviews,
  };
}

export async function getSelectionBypassOverview() {
  await requireSuperAdmin();
  const db = await createUteroAcademyServiceRoleClient();
  const [applications, tests, bypasses] = await Promise.all([
    db.from("internship_applications").select("id,full_name,email,selection_status").order("created_at", { ascending: false }).limit(200),
    db.from("selection_test_packages").select("id,title,version").order("title"),
    db.from("selection_bypasses").select("id,application_id,reason,bypassed_at,bypassed_by").order("bypassed_at", { ascending: false }).limit(100),
  ]);
  for (const result of [applications, tests, bypasses]) if (result.error) throw new Error(result.error.message);
  return { applications: applications.data ?? [], tests: tests.data ?? [], bypasses: bypasses.data ?? [] };
}
