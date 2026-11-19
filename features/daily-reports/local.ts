import { backendRequest } from "@/lib/backend/server";
import { resolveStorageUrl } from "@/lib/storage-urls";
import { validateUpload, UploadValidationError } from "@/lib/uploads";
import { isAllowedDriveLink } from "@/lib/external-links";
import { revalidatePath } from "next/cache";
import { dailyReportSchema, reviewReportSchema } from "./schemas";
import { type DailyReportAttachment, type DailyReportReview, type DailyReportWithIntern } from "./types";

async function signAttachments(attachments: DailyReportAttachment[]) {
  return Promise.all(attachments.map(async (item) => item.mime_type === "url" ? item : {
    ...item, file_path: await resolveStorageUrl("daily-report", item.file_path),
  }));
}

export async function localProfiles() {
  const response = await backendRequest("/v1/daily-reports/profile");
  if (!response.ok) throw new Error("Gagal membaca profil lokal.");
  return response.json() as Promise<{ internProfileId: string | null; mentorProfileId: string | null }>;
}

export async function localInternForPrint(internId: string) {
  const response = await backendRequest(`/v1/daily-reports/intern/${encodeURIComponent(internId)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Gagal membaca profil peserta lokal.");
  return ((await response.json()) as { intern: Record<string, any> }).intern;
}

export async function localReports(internId?: string | null, options: {
  page?: number; limit?: number; status?: string; reportId?: string;
  internIds?: string[]; includeAttachments?: boolean;
} = {}): Promise<DailyReportWithIntern[]> {
  if (!options.limit && !options.reportId) {
    const reports: DailyReportWithIntern[] = [];
    for (let page = 1; ; page++) {
      const batch = await localReports(internId, { ...options, page, limit: 100 });
      reports.push(...batch);
      if (batch.length < 100) return reports;
    }
  }
  const params = new URLSearchParams();
  if (internId) params.set("internId", internId);
  if (options.page) params.set("page", String(options.page));
  if (options.limit) params.set("limit", String(options.limit));
  if (options.status && options.status !== "all") params.set("status", options.status);
  if (options.reportId) params.set("reportId", options.reportId);
  if (options.internIds) params.set("internIds", options.internIds.join(","));
  if (options.includeAttachments) params.set("includeAttachments", "true");
  const path = `/v1/daily-reports?${params.toString()}`;
  const response = await backendRequest(path);
  if (!response.ok) throw new Error("Gagal membaca laporan lokal.");
  const body = await response.json() as { reports: DailyReportWithIntern[] };
  if (!options.includeAttachments) return body.reports.map((report) => ({ ...report, daily_report_attachments: [] }));
  return Promise.all(body.reports.map(async (report) => ({ ...report, daily_report_attachments: await signAttachments(report.daily_report_attachments) })));
}

export async function localReviews(reportId: string): Promise<DailyReportReview[]> {
  const response = await backendRequest(`/v1/daily-reports/${encodeURIComponent(reportId)}/reviews`);
  if (!response.ok) throw new Error("Gagal membaca review laporan lokal.");
  return ((await response.json()) as { reviews: DailyReportReview[] }).reviews;
}

export async function localSubmit(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const parsed = dailyReportSchema.safeParse({ reportDate: formData.get("reportDate"), todayWork: formData.get("todayWork"),
    progress: formData.get("progress") || undefined, blockers: formData.get("blockers") || undefined,
    tomorrowPlan: formData.get("tomorrowPlan") || undefined });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data laporan tidak valid." };
  const googleDriveLink = String(formData.get("googleDriveLink") || "");
  if (googleDriveLink && !isAllowedDriveLink(googleDriveLink)) return { ok: false, message: "Link lampiran harus URL Google Drive https yang valid." };
  try {
    const attachments = await Promise.all(formData.getAll("attachment").filter((item): item is File => item instanceof File && item.size > 0).map(async (file) => {
      const value = await validateUpload(file, ["image", "document"]);
      return { dataUrl: `data:${value.contentType};base64,${Buffer.from(value.buffer).toString("base64")}`, fileName: value.displayName };
    }));
    const response = await backendRequest("/v1/daily-reports", { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(60_000), body: JSON.stringify({
      ...parsed.data, reportId: formData.get("reportId") || undefined, googleDriveLink, attachments,
    }) });
    if (!response.ok) return { ok: false, message: response.status === 409 ? "Laporan untuk tanggal ini sudah pernah dikirim." : "Laporan belum berhasil disimpan. Coba lagi." };
    revalidatePath("/dashboard/intern/daily-reports");
    return { ok: true, message: formData.get("reportId") ? "Laporan harian berhasil diperbarui." : "Laporan harian berhasil dikirim." };
  } catch (error) { return { ok: false, message: error instanceof UploadValidationError ? `Lampiran ditolak: ${error.message}` : "Lampiran tidak dapat diproses." }; }
}

export async function localReview(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const parsed = reviewReportSchema.safeParse({ reportId: formData.get("reportId"), status: formData.get("status"), note: formData.get("note") });
  if (!parsed.success) return { ok: false, message: "Data review tidak valid." };
  const response = await backendRequest(`/v1/daily-reports/${parsed.data.reportId}/review`, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    const messages: Record<string, string> = {
      setup_required: "Profil reviewer belum disiapkan. Hubungi super admin.",
      forbidden: "Kamu tidak berhak mereview laporan peserta ini.",
      not_found: "Laporan tidak ditemukan.",
    };
    return { ok: false, message: messages[payload?.error || ""] || "Review belum berhasil disimpan." };
  }
  revalidatePath("/dashboard/mentor/daily-reports");
  return { ok: true, message: "Review berhasil disimpan." };
}
