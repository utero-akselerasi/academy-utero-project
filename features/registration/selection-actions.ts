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
  const data = await (await backendRequest(`/v1/registration/selection/${assignmentId}`)).json() as { attempt?: { id: string } };
  if (!data.attempt?.id) throw new Error("Percobaan tidak aktif.");
  let attachmentPath: string | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size) {
    const upload = await validateUpload(file, ["document", "image"]);
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
