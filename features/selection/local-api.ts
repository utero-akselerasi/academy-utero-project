import { backendRequest } from "@/lib/backend/server";

export async function selectionRequest(path: string, method = "GET", body?: object) {
  const response = await backendRequest(`/v1/selection/staff${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) {
    const failure = await response.json().catch(() => null);
    const code = failure?.error;
    const stateLabels: Record<string, string> = { assigned: "belum dimulai", available: "siap dikerjakan", in_progress: "sedang dikerjakan", submitted: "jawaban sudah dikirim", grading: "menunggu penilaian", graded: "sudah dinilai", passed: "lulus", failed: "tidak lulus", expired: "kedaluwarsa" };
    const messages: Record<string, string> = {
      already_assigned: "Tes ini sudah pernah ditugaskan. Periksa status dan histori peserta sebelum membuat penugasan ulang.",
      assignment_still_active: "Peserta masih mengerjakan atau jawabannya menunggu penilaian. Penugasan ulang belum diizinkan.",
      assignment_conflict: "Penugasan berubah bersamaan. Muat ulang data seleksi lalu coba lagi.",
      assignment_not_allowed: "Paket belum terbit atau jalur seleksi peserta tidak cocok.",
      assignment_target_missing: "Peserta atau paket tes tidak ditemukan.",
      test_not_published: "Paket tes belum diterbitkan.",
      track_mismatch: "Jalur seleksi peserta tidak cocok dengan paket tes.",
      retry_reason_required: "Penugasan ulang memerlukan alasan minimal 15 karakter.",
      retry_has_answers: "Peserta telah menyimpan jawaban. Tinjau jawaban sebelum memutuskan langkah berikutnya.",
      invalid_due_date: "Batas waktu penugasan harus berada di masa depan.",
      correction_started: "Tes sudah dimulai. Demi menjaga jawaban dan hasil, paket tidak dapat diganti.",
      invalid_correction: "Pilih paket aktif dan tuliskan alasan koreksi.",
      same_package: "Pilih paket tes yang berbeda.",
    };
    if (code === "already_assigned") throw new Error(`Tes sudah ditugaskan: ${stateLabels[failure?.state] ?? "lihat histori peserta"}. Periksa status peserta sebelum memberikan kesempatan ulang.`);
    throw new Error(messages[code] ?? "Backend seleksi gagal memproses permintaan.");
  }
  return response.json();
}
