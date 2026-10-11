"use server";

import { requireApplicant } from "@/features/auth/guards";
import { createSupabaseServiceRoleClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { validateUpload } from "@/lib/uploads";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getApplicantAttempt } from "./applicant";
import { calculateSelectionScore } from "./scoring";

const uuid = z.string().uuid();
const path = "/dashboard/applicant/selection";

export async function startSelectionAttemptAction(formData: FormData) {
  const user = await requireApplicant();
  const assignmentId = uuid.parse(formData.get("assignmentId"));
  const { assignment, test, attempt } = await getApplicantAttempt(assignmentId);
  const now = Date.now();
  if (assignment.due_at && now >= Date.parse(assignment.due_at)) throw new Error("Batas penugasan telah lewat.");
  if (test.available_from && now < Date.parse(test.available_from)) throw new Error("Tes belum dibuka.");
  if (test.available_until && now >= Date.parse(test.available_until)) throw new Error("Tes sudah ditutup.");
  if (attempt?.status === "in_progress" && attempt.expires_at && now < Date.parse(attempt.expires_at)) return;
  if (attempt && !["graded", "expired", "cancelled"].includes(attempt.status)) throw new Error("Percobaan sebelumnya belum selesai.");
  if ((attempt?.attempt_number ?? 0) >= assignment.max_attempts) throw new Error("Batas percobaan tercapai.");
  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db.from("selection_attempts").insert({ assignment_id: assignmentId, applicant_user_id: user.id, attempt_number: (attempt?.attempt_number ?? 0) + 1, status: "in_progress", started_at: new Date(now).toISOString(), expires_at: new Date(now + test.duration_minutes * 60000).toISOString() });
  if (error) throw new Error(error.message);
  const { error: assignmentError } = await db.from("selection_assignments").update({ status: "in_progress" }).eq("id", assignmentId);
  if (assignmentError) throw new Error(assignmentError.message);
  revalidatePath(path);
}

export async function saveSelectionAnswerAction(formData: FormData) {
  await requireApplicant();
  const assignmentId = uuid.parse(formData.get("assignmentId"));
  const questionId = uuid.parse(formData.get("questionId"));
  const { assignment, test, attempt } = await getApplicantAttempt(assignmentId);
  const now = Date.now();
  if (test.available_from && now < Date.parse(test.available_from)) throw new Error("Tes belum dibuka.");
  if (test.available_until && now >= Date.parse(test.available_until)) throw new Error("Tes sudah ditutup.");
  if (attempt?.status !== "in_progress" || !attempt.expires_at || now >= Date.parse(attempt.expires_at)) throw new Error("Waktu pengerjaan habis.");
  if (assignment.due_at && now >= Date.parse(assignment.due_at)) throw new Error("Batas penugasan telah lewat.");
  const db = await createUteroAcademyServiceRoleClient();
  const { data: question } = await db.from("selection_questions").select("id,question_type").eq("id", questionId).eq("package_id", assignment.package_id).single();
  if (!question) throw new Error("Soal tidak ditemukan pada paket ini.");
  const text = String(formData.get("answerText") ?? "").trim();
  if (text.length > 10000) throw new Error("Jawaban terlalu panjang.");
  let selectedOptionIds: string[] = [];
  if (["multiple_choice", "true_false"].includes(question.question_type)) {
    const selected = uuid.parse(formData.get("optionId"));
    const { data: option } = await db.from("selection_question_options").select("id").eq("id", selected).eq("question_id", questionId).single();
    if (!option) throw new Error("Opsi tidak valid.");
    selectedOptionIds = [option.id];
  }
  let attachmentPath: string | null = null;
  let previousAttachmentPath: string | null = null;
  if (question.question_type === "file_upload") {
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      const { data: previousAnswer, error: previousError } = await db.from("selection_answers")
        .select("attachment_path").eq("attempt_id", attempt.id).eq("question_id", questionId).maybeSingle();
      if (previousError) throw new Error(previousError.message);
      previousAttachmentPath = previousAnswer?.attachment_path ?? null;
      const validated = await validateUpload(file, ["document", "image"]);
      attachmentPath = `selection/${attempt.id}/${questionId}/${crypto.randomUUID()}.${validated.ext}`;
      const { error: uploadError } = await createSupabaseServiceRoleClient().storage.from("selection-answers").upload(attachmentPath, validated.buffer, { contentType: validated.contentType, upsert: false });
      if (uploadError) throw new Error("Gagal mengunggah jawaban.");
    }
  }
  const { error } = await db.from("selection_answers").upsert({ attempt_id: attempt.id, question_id: questionId, selected_option_ids: selectedOptionIds, answer_text: question.question_type === "file_upload" ? null : text || null, ...(attachmentPath ? { attachment_path: attachmentPath } : {}), answered_at: new Date().toISOString() }, { onConflict: "attempt_id,question_id" });
  if (error) {
    if (attachmentPath) await createSupabaseServiceRoleClient().storage.from("selection-answers").remove([attachmentPath]);
    throw new Error(error.message);
  }
  if (attachmentPath && previousAttachmentPath?.startsWith(`selection/${attempt.id}/${questionId}/`)) {
    const { error: cleanupError } = await createSupabaseServiceRoleClient().storage
      .from("selection-answers").remove([previousAttachmentPath]);
    if (cleanupError) console.error("Gagal membersihkan jawaban berkas lama:", cleanupError);
  }
  revalidatePath(`${path}/${assignmentId}`);
}

export async function submitSelectionAttemptAction(formData: FormData) {
  await requireApplicant();
  const assignmentId = uuid.parse(formData.get("assignmentId"));
  const { assignment, test, attempt, questions } = await getApplicantAttempt(assignmentId);
  if (attempt?.status !== "in_progress") throw new Error("Percobaan tidak aktif.");
  const now = Date.now();
  if (test.available_from && now < Date.parse(test.available_from)) throw new Error("Tes belum dibuka.");
  if (test.available_until && now >= Date.parse(test.available_until)) throw new Error("Tes sudah ditutup.");
  const db = await createUteroAcademyServiceRoleClient();
  if (!attempt.expires_at || now >= Date.parse(attempt.expires_at) || assignment.due_at && now >= Date.parse(assignment.due_at)) {
    const { error: expiryError } = await db.from("selection_attempts").update({ status: "expired" }).eq("id", attempt.id).eq("status", "in_progress");
    if (expiryError) throw new Error(expiryError.message);
    revalidatePath(path);
    return;
  }
  const { data: answers, error: answersError } = await db.from("selection_answers").select("id,question_id,selected_option_ids,answer_text,attachment_path").eq("attempt_id", attempt.id);
  if (answersError) throw new Error(answersError.message);
  if (questions.some((question) => question.is_required && !(answers ?? []).some((answer) => answer.question_id === question.id && (answer.selected_option_ids.length || answer.answer_text || answer.attachment_path)))) throw new Error("Jawab semua soal wajib sebelum mengirim.");
  const optionIds = (answers ?? []).flatMap((answer) => answer.selected_option_ids);
  const options = optionIds.length ? await db.from("selection_question_options").select("id,question_id,is_correct").in("id", optionIds) : { data: [], error: null };
  if (options.error) throw new Error(options.error.message);
  const objective = questions.filter((question) => ["multiple_choice", "true_false"].includes(question.question_type));
  for (const question of objective) {
    const answer = (answers ?? []).find((item) => item.question_id === question.id);
    if (!answer) continue;
    const selected = options.data?.find((option) => option.id === answer.selected_option_ids[0] && option.question_id === question.id);
    const { error } = await db.from("selection_answers").update({ auto_score: selected?.is_correct ? question.points : 0, is_final: true }).eq("id", answer.id);
    if (error) throw new Error(error.message);
  }
  const manualRequired = questions.some((question) => !["multiple_choice", "true_false"].includes(question.question_type));
  const score = manualRequired ? null : calculateSelectionScore(questions.map((question) => {
    const answer = (answers ?? []).find((entry) => entry.question_id === question.id);
    const selected = options.data?.find((option) => option.id === answer?.selected_option_ids[0] && option.question_id === question.id);
    return { maxPoints: question.points, awardedPoints: answer ? selected?.is_correct ? question.points : 0 : 0 };
  }));
  const { error } = await db.from("selection_attempts").update({ status: manualRequired ? "grading" : "graded", submitted_at: new Date(now).toISOString(), final_score: score }).eq("id", attempt.id).eq("status", "in_progress");
  if (error) throw new Error(error.message);
  const { error: assignmentError } = await db.from("selection_assignments").update({ status: "grading" }).eq("id", assignmentId);
  if (assignmentError) throw new Error(assignmentError.message);
  revalidatePath(path);
}
