export function formatApplicationDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+07:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta",
  }).format(date);
}
export function formatApplicationTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("id-ID", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
  }).format(date);
}

const statusLabels: Record<string, string> = {
  draft: "Draf", submitted: "Menunggu tinjauan", reviewed: "Sudah ditinjau", document_review: "Review dokumen",
  revision_requested: "Perlu revisi", selection: "Tahap seleksi", waitlisted: "Daftar tunggu",
  accepted: "Diterima", rejected: "Ditolak", cancelled: "Dibatalkan", converted: "Menjadi peserta",
  not_assigned: "Belum ditugaskan", not_started: "Belum dimulai", accepted_pending_onboarding: "Menunggu onboarding",
  biodata_review: "Review biodata", onboarding_complete: "Onboarding selesai", in_progress: "Berlangsung",
  passed: "Lolos seleksi", failed: "Belum lolos", assigned: "Tes ditugaskan", completed: "Tes selesai",
  expired: "Waktu habis", submitted_for_review: "Menunggu penilaian", pending: "Menunggu",
  graded: "Sudah dinilai", timed_out: "Waktu habis",
};

export function applicationStatusLabel(value: string | null | undefined): string {
  return statusLabels[value ?? ""] ?? (value ? value.replaceAll("_", " ") : "Belum tersedia");
}
