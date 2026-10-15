"use server";

import { requireAdmin, requireSuperAdmin } from "@/features/auth/guards";
import { writeAuditLog } from "@/features/super-admin/audit";
import { createUteroAcademyClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  assignApplicantSchema, bypassSchema, createMaterialSchema, createQuestionSchema,
  createTestSchema, createTrackSchema, decisionSchema, formDataObject, gradeAnswerSchema,
  parseOptionLines,
} from "./schemas";
import { calculateSelectionScore, recommendedSelectionDecision } from "./scoring";
import { z } from "zod";
import { usesLocalBackend } from "@/lib/backend/server";
import { selectionRequest } from "./local-api";

const mentorPath = "/dashboard/mentor/selection";
const superAdminPath = "/dashboard/super-admin/selection";

function parsed<T>(result: { success: boolean; data?: T; error?: { issues: Array<{ message: string }> } }): T {
  if (!result.success) throw new Error(result.error?.issues[0]?.message ?? "Data tidak valid.");
  return result.data as T;
}

export async function createSelectionTrackAction(formData: FormData) {
  const user = await requireAdmin();
  const input = parsed(createTrackSchema.safeParse(formDataObject(formData)));
  if (usesLocalBackend()) { await selectionRequest("/tracks", "POST", input); revalidatePath(mentorPath); return; }
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db.from("selection_tracks").insert({ ...input, description: input.description || null, is_active: true, created_by: user.id }).select("id").single();
  if (error) throw new Error(`Gagal membuat jalur: ${error.message}`);
  await writeAuditLog(user.id, "create_selection_track", "selection_tracks", data.id, null, input);
  revalidatePath(mentorPath);
}

export async function createSelectionMaterialAction(formData: FormData) {
  const user = await requireAdmin();
  const input = parsed(createMaterialSchema.safeParse(formDataObject(formData)));
  if (usesLocalBackend()) { await selectionRequest("/materials", "POST", input); revalidatePath(mentorPath); return; }
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db.from("selection_materials").insert({
    track_id: input.trackId, title: input.title, content: { body: input.content },
    attachment_path: input.attachmentPath || null, order_index: input.orderIndex, is_published: false, created_by: user.id,
  }).select("id").single();
  if (error) throw new Error(`Gagal membuat materi: ${error.message}`);
  await writeAuditLog(user.id, "create_selection_material", "selection_materials", data.id, null, input);
  revalidatePath(mentorPath);
}

export async function publishSelectionMaterialAction(formData: FormData) {
  const user = await requireAdmin();
  const materialId = z.string().uuid().parse(formData.get("materialId"));
  if (usesLocalBackend()) { await selectionRequest(`/materials/${materialId}/publish`, "POST"); revalidatePath(mentorPath); return; }
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db.from("selection_materials").update({ is_published: true }).eq("id", materialId).eq("is_published", false).select("id").maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "Materi tidak ditemukan atau sudah terbit.");
  await writeAuditLog(user.id, "publish_selection_material", "selection_materials", materialId);
  revalidatePath(mentorPath);
}

export async function createSelectionTestAction(formData: FormData) {
  const user = await requireAdmin();
  const input = parsed(createTestSchema.safeParse(formDataObject(formData)));
  if (usesLocalBackend()) { await selectionRequest("/tests", "POST", input); revalidatePath(mentorPath); return; }
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db.from("selection_test_packages").insert({
    code: input.code, track_id: input.trackId, title: input.title, description: input.description || null, version: 1,
    passing_score: input.passingScore, duration_minutes: input.durationMinutes,
    max_attempts: input.maxAttempts, is_published: false, created_by: user.id,
  }).select("id").single();
  if (error) throw new Error(`Gagal membuat tes: ${error.message}`);
  await writeAuditLog(user.id, "create_selection_test", "selection_test_packages", data.id, null, input);
  revalidatePath(mentorPath);
}

export async function createSelectionQuestionAction(formData: FormData) {
  const user = await requireAdmin();
  const input = parsed(createQuestionSchema.safeParse(formDataObject(formData)));
  if (usesLocalBackend()) { await selectionRequest(`/tests/${input.testId}/questions`, "POST", { ...input, options: ["multiple_choice", "true_false"].includes(input.type) ? parseOptionLines(input.type === "true_false" ? "Benar\nSalah" : input.options) : [] }); revalidatePath(mentorPath); return; }
  const db = await createUteroAcademyServiceRoleClient();
  const { data: test, error: testError } = await db.from("selection_test_packages").select("id,is_published").eq("id", input.testId).single();
  if (testError || !test) throw new Error("Tes tidak ditemukan.");
  if (test.is_published) throw new Error("Tes yang sudah terbit tidak dapat diubah. Buat versi baru.");
  const { data: question, error } = await db.from("selection_questions").insert({
    package_id: input.testId, question_type: input.type, prompt: { text: input.prompt }, points: input.points,
    order_index: input.orderIndex, answer_key: input.expectedAnswer ? { value: input.expectedAnswer } : null, created_by: user.id,
  }).select("id").single();
  if (error) throw new Error(`Gagal membuat pertanyaan: ${error.message}`);
  if (["multiple_choice", "true_false"].includes(input.type)) {
    const options = parseOptionLines(input.type === "true_false" ? "Benar\nSalah" : input.options);
    const { error: optionError } = await db.from("selection_question_options").insert(options.map((label, orderIndex) => ({
      question_id: question.id, label, content: { text: label }, order_index: orderIndex, is_correct: label === input.correctOption,
    })));
    if (optionError) {
      await db.from("selection_questions").delete().eq("id", question.id);
      throw new Error(`Gagal membuat opsi pertanyaan: ${optionError.message}`);
    }
  }
  await writeAuditLog(user.id, "create_selection_question", "selection_questions", question.id, null, { ...input, correctOption: input.correctOption ? "[configured]" : "" });
  revalidatePath(mentorPath);
}

export async function publishSelectionTestAction(formData: FormData) {
  const user = await requireAdmin();
  const testId = z.string().uuid().parse(formData.get("testId"));
  if (usesLocalBackend()) { await selectionRequest(`/tests/${testId}/publish`, "POST"); revalidatePath(mentorPath); return; }
  const db = await createUteroAcademyServiceRoleClient();
  const { count, error: countError } = await db.from("selection_questions").select("id", { count: "exact", head: true }).eq("package_id", testId);
  if (countError || !count) throw new Error("Tes minimal memiliki satu pertanyaan sebelum diterbitkan.");
  const { data: published, error } = await db.from("selection_test_packages").update({ is_published: true, published_at: new Date().toISOString() }).eq("id", testId).eq("is_published", false).select("id").maybeSingle();
  if (error) throw new Error(`Gagal menerbitkan tes: ${error.message}`);
  if (!published) throw new Error("Tes sudah terbit atau tidak ditemukan.");
  await writeAuditLog(user.id, "publish_selection_test", "selection_test_packages", testId);
  revalidatePath(mentorPath);
}

export async function versionSelectionTestAction(formData: FormData) {
  const user = await requireAdmin();
  const testId = z.string().uuid().parse(formData.get("testId"));
  if (usesLocalBackend()) { await selectionRequest(`/tests/${testId}/version`, "POST"); revalidatePath(mentorPath); return; }
  const db = await createUteroAcademyServiceRoleClient();
  const { data: source, error } = await db.from("selection_test_packages").select("code,track_id,title,description,version,passing_score,duration_minutes,max_attempts").eq("id", testId).single();
  if (error || !source) throw new Error("Tes sumber tidak ditemukan.");
  const { data: copy, error: copyError } = await db.from("selection_test_packages").insert({ ...source, version: source.version + 1, is_published: false, created_by: user.id }).select("id").single();
  if (copyError) throw new Error(`Gagal membuat versi tes: ${copyError.message}`);
  const { data: questions, error: questionError } = await db.from("selection_questions").select("id,question_type,prompt,points,order_index,answer_key").eq("package_id", testId).order("order_index");
  if (questionError) throw new Error(questionError.message);
  for (const question of questions ?? []) {
    const { data: newQuestion, error: insertError } = await db.from("selection_questions").insert({ question_type: question.question_type, prompt: question.prompt, points: question.points, order_index: question.order_index, answer_key: question.answer_key, package_id: copy.id, created_by: user.id }).select("id").single();
    if (insertError) throw new Error(`Versi dibuat, tetapi pertanyaan gagal disalin: ${insertError.message}`);
    const { data: options, error: optionsError } = await db.from("selection_question_options").select("label,content,is_correct,order_index").eq("question_id", question.id);
    if (optionsError) throw new Error(optionsError.message);
    if (options?.length) {
      const { error: insertOptionsError } = await db.from("selection_question_options").insert(options.map((option) => ({ ...option, question_id: newQuestion.id })));
      if (insertOptionsError) throw new Error(insertOptionsError.message);
    }
  }
  await writeAuditLog(user.id, "version_selection_test", "selection_test_packages", copy.id, { source_id: testId }, { version: source.version + 1 });
  revalidatePath(mentorPath);
}

export async function assignSelectionTestAction(formData: FormData) {
  const user = await requireAdmin();
  const input = parsed(assignApplicantSchema.safeParse(formDataObject(formData)));
  if (usesLocalBackend()) { await selectionRequest("/assignments", "POST", input); revalidatePath(mentorPath); return; }
  const db = await createUteroAcademyServiceRoleClient();
  const { data: test } = await db.from("selection_test_packages").select("is_published,max_attempts,track_id").eq("id", input.testId).single();
  if (!test?.is_published) throw new Error("Hanya tes terbit yang dapat ditugaskan.");
  const { data: applicant } = await db.from("internship_applications").select("id,selection_track_id").eq("id", input.applicationId).single();
  if (!applicant || (applicant.selection_track_id && applicant.selection_track_id !== test.track_id)) throw new Error("Jalur seleksi pelamar tidak sesuai paket tes.");
  const { data, error } = await db.from("selection_assignments").insert({ application_id: input.applicationId, package_id: input.testId, max_attempts: test.max_attempts, status: "assigned", due_at: input.dueAt ? new Date(input.dueAt).toISOString() : null, assigned_by: user.id }).select("id").single();
  if (error) throw new Error(`Gagal menugaskan tes: ${error.message}`);
  const { error: statusError } = await db.from("internship_applications").update({ selection_status: "assigned", selection_track_id: test.track_id }).eq("id", input.applicationId);
  if (statusError) throw new Error(statusError.message);
  await writeAuditLog(user.id, "assign_selection_test", "selection_assignments", data.id, null, input);
  revalidatePath(mentorPath);
}

export async function gradeSelectionAnswerAction(formData: FormData) {
  const user = await requireAdmin();
  const input = parsed(gradeAnswerSchema.safeParse(formDataObject(formData)));
  if (usesLocalBackend()) { await selectionRequest(`/answers/${input.answerId}/grade`, "POST", input); revalidatePath(mentorPath); return; }
  const db = await createUteroAcademyServiceRoleClient();
  const { data: answer } = await db.from("selection_answers").select("id,attempt_id,question_id").eq("id", input.answerId).single();
  if (!answer) throw new Error("Jawaban tidak ditemukan.");
  const { data: attempt } = await db.from("selection_attempts").select("id,status").eq("id", answer.attempt_id).eq("assignment_id", input.assignmentId).single();
  if (!attempt || !["submitted", "grading", "graded"].includes(attempt.status)) throw new Error("Percobaan belum siap dinilai.");
  const { data: question } = await db.from("selection_questions").select("points,question_type").eq("id", answer.question_id).single();
  if (!question || question.points !== input.maxPoints || input.awardedPoints > question.points) throw new Error("Bobot soal tidak sesuai.");
  const { error } = await db.from("selection_grades").upsert({ answer_id: answer.id, grader_user_id: user.id, score: input.awardedPoints, feedback: input.feedback || null }, { onConflict: "answer_id,grader_user_id" });
  if (error) throw new Error(`Gagal menyimpan nilai: ${error.message}`);
  const { error: answerError } = await db.from("selection_answers").update({ manual_score: input.awardedPoints }).eq("id", answer.id);
  if (answerError) throw new Error(answerError.message);
  const { data: assignment } = await db.from("selection_assignments").select("package_id").eq("id", input.assignmentId).single();
  if (assignment) {
    const [{ data: answers }, { data: questions }, { data: test }] = await Promise.all([
      db.from("selection_answers").select("question_id,manual_score,auto_score").eq("attempt_id", attempt.id),
      db.from("selection_questions").select("id,points").eq("package_id", assignment.package_id),
      db.from("selection_test_packages").select("passing_score").eq("id", assignment.package_id).single(),
    ]);
    const score = calculateSelectionScore((questions ?? []).map((item) => {
      const result = (answers ?? []).find((entry) => entry.question_id === item.id);
      return { maxPoints: item.points, awardedPoints: result?.manual_score ?? result?.auto_score ?? null };
    }));
    const status = recommendedSelectionDecision(score, test?.passing_score ?? 0);
    const { error: attemptError } = await db.from("selection_attempts").update({ final_score: score, status: status === "grading" ? "grading" : "graded" }).eq("id", attempt.id);
    if (attemptError) throw new Error(attemptError.message);
    const { error: assignmentError } = await db.from("selection_assignments").update({ status }).eq("id", input.assignmentId);
    if (assignmentError) throw new Error(assignmentError.message);
  }
  await writeAuditLog(user.id, "grade_selection_answer", "selection_answers", input.answerId, null, { awardedPoints: input.awardedPoints, feedback: input.feedback });
  revalidatePath(mentorPath);
}

export async function decideSelectionAction(formData: FormData) {
  await requireAdmin();
  const input = parsed(decisionSchema.safeParse(formDataObject(formData)));
  if (usesLocalBackend()) { await selectionRequest("/decisions", "POST", input); revalidatePath(mentorPath); return; }
  const db = await createUteroAcademyClient();
  const { error } = await db.rpc("decide_selection_atomically", {
    p_assignment_id: input.assignmentId,
    p_application_id: input.applicationId,
    p_result: input.decision,
    p_public_note: input.notes || null,
  });
  if (error) throw new Error(`Gagal menyimpan keputusan: ${error.message}`);
  revalidatePath(mentorPath);
}

export async function bypassSelectionAction(formData: FormData) {
  const user = await requireSuperAdmin();
  const input = parsed(bypassSchema.safeParse(formDataObject(formData)));
  if (usesLocalBackend()) { await selectionRequest("/bypass", "POST", input); revalidatePath(superAdminPath); revalidatePath(mentorPath); return; }
  const db = await createUteroAcademyClient();
  const { data, error } = await db.rpc("bypass_selection", { p_application_id: input.applicationId, p_reason: input.reason, p_assignment_id: input.assignmentId || null, p_supporting_document_path: null });
  if (error) throw new Error(`Gagal menyimpan bypass: ${error.message}`);
  await writeAuditLog(user.id, "bypass_selection", "selection_bypasses", data, null, { applicationId: input.applicationId, assignmentId: input.assignmentId || null, reason: input.reason });
  revalidatePath(superAdminPath);
  revalidatePath(mentorPath);
}
