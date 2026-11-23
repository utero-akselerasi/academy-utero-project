"use server";

import { requireApplicant } from "@/features/auth/guards";
import { backendRequest, usesLocalBackend } from "@/lib/backend/server";
import { buildStoragePath, validateUpload } from "@/lib/uploads";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const uuid = z.string().uuid();
const path = "/dashboard/applicant/selection";

async function localCall(route: string, options: RequestInit) {
  const response = await backendRequest(route, options);
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(result.error ?? "Operasi seleksi gagal.");
  }
  return response;
}

export async function startApplicantSelectionAction(formData: FormData) {
  if (!usesLocalBackend()) return (await import("@/features/selection/applicant-actions")).startSelectionAttemptAction(formData);
  await requireApplicant();
  const assignmentId = uuid.parse(formData.get("assignmentId"));
  await localCall(`/v1/registration/selection/${assignmentId}/start`, { method: "POST" });
  revalidatePath(path);
}

export async function saveApplicantSelectionAnswerAction(formData: FormData) {
  if (!usesLocalBackend()) return (await import("@/features/selection/applicant-actions")).saveSelectionAnswerAction(formData);
  const user = await requireApplicant();
  const assignmentId = uuid.parse(formData.get("assignmentId"));
  const questionId = uuid.parse(formData.get("questionId"));
  const attemptResponse = await backendRequest(`/v1/registration/selection/${assignmentId}`);
  if (!attemptResponse.ok) throw new Error("Tes tidak tersedia.");
  const data = await attemptResponse.json() as { attempt?: { id: string }; active?: boolean; questions?: Array<{ id: string; question_type: string; response_config?: { mode: "file" | "google_drive"; allowedExtensions: string[] } }> };
  if (!data.active || !data.attempt?.id) throw new Error("Percobaan tidak aktif.");
  const question = data.questions?.find((item) => item.id === questionId);
  if (!question) throw new Error("Soal tidak ditemukan.");
  let attachmentPath: string | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size) {
    if (question.question_type !== "file_upload" || question.response_config?.mode === "google_drive") throw new Error("Berkas tidak diperbolehkan untuk soal ini.");
    const upload = await validateUpload(file, ["document", "image"]);
    if (!(question.response_config?.allowedExtensions ?? ["pdf", "docx", "png", "jpg", "jpeg", "gif", "webp"]).some((ext) => (ext === "jpeg" ? "jpg" : ext) === upload.ext)) throw new Error("Format berkas tidak diizinkan untuk soal ini.");
    attachmentPath = buildStoragePath(`${user.id}/selection/${data.attempt.id}/${questionId}`, upload.ext);
    const body = new FormData();
    body.append("file", new Blob([Buffer.from(upload.buffer)], { type: upload.contentType }), upload.displayName);
    await localCall("/v1/storage/selection-answers", { method: "POST", headers: { "x-object-path": attachmentPath }, body });
  }
  try {
    const response = await localCall(`/v1/registration/selection/${assignmentId}/answers/${questionId}`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({
        optionId: formData.get("optionId") || null,
        answerText: String(formData.get("answerText") ?? ""), attachmentPath,
      }),
    });
    const result = await response.json() as { previousAttachmentPath?: string | null };
    if (attachmentPath && result.previousAttachmentPath?.startsWith(`${user.id}/selection/${data.attempt.id}/${questionId}/`)) {
      await backendRequest(`/v1/storage/selection-answers/${result.previousAttachmentPath}`, { method: "DELETE" });
    }
  } catch (error) {
    if (attachmentPath) await backendRequest(`/v1/storage/selection-answers/${attachmentPath}`, { method: "DELETE" });
    throw error;
  }
  revalidatePath(`${path}/${assignmentId}`);
}

export async function submitApplicantSelectionAction(formData: FormData) {
  if (!usesLocalBackend()) return (await import("@/features/selection/applicant-actions")).submitSelectionAttemptAction(formData);
  await requireApplicant();
  const assignmentId = uuid.parse(formData.get("assignmentId"));
  await localCall(`/v1/registration/selection/${assignmentId}/submit`, { method: "POST" });
  revalidatePath(path);
}
