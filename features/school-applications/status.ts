import type { SchoolApplication } from "./types";

const labels: Record<string, string> = {
  draft: "Draft", submitted: "Dikirim", reviewed: "Ditinjau", document_review: "Review dokumen", revision_requested: "Perlu revisi", not_started: "Belum daftar ulang",
  selection: "Tahap seleksi", waitlisted: "Daftar tunggu", accepted: "Diterima", rejected: "Tidak lolos",
  cancelled: "Dibatalkan", converted: "Menjadi peserta", not_assigned: "Belum dijadwalkan", assigned: "Tes ditugaskan",
  available: "Tes tersedia", in_progress: "Sedang dikerjakan", grading: "Sedang dinilai", passed: "Lolos seleksi",
  failed: "Tidak lolos", expired: "Kedaluwarsa", bypassed: "Lolos melalui keputusan khusus", accepted_pending_onboarding: "Menunggu daftar ulang",
  biodata_review: "Review biodata", onboarding_complete: "Daftar ulang selesai", waiting_start: "Menunggu tanggal mulai",
  active: "Aktif magang", paused: "Ditangguhkan", completed: "Selesai", alumni: "Alumni",
};

export function statusLabel(status: string) {
  return labels[status] ?? status.replaceAll("_", " ");
}

export function buildPublicTimeline(application: SchoolApplication) {
  const timeline = [{ label: "Pendaftaran dikirim", at: application.createdAt }];
  if (application.status !== "submitted") timeline.push({ label: statusLabel(application.status), at: application.reviewedAt ?? application.updatedAt });
  if (application.selectionStatus !== "not_assigned") timeline.push({ label: `Seleksi: ${statusLabel(application.selectionStatus)}`, at: application.updatedAt });
  if (application.onboardingStatus !== "not_started") timeline.push({ label: `Onboarding: ${statusLabel(application.onboardingStatus)}`, at: application.updatedAt });
  return timeline;
}
