import { backendRequest, usesLocalBackend } from "@/lib/backend/server";

export type ApplicantDashboardData = {
  profile: { full_name: string } | null;
  programs: Array<{ id: string; name: string }>;
  applications: Array<Record<string, string | null>>;
  notifications: Array<{ id: string; subject: string | null; payload: unknown; status: string; created_at: string }>;
};

export async function getLocalApplicantDashboard() {
  const response = await backendRequest("/v1/registration/dashboard");
  if (!response.ok) throw new Error("Gagal memuat portal pelamar dari backend lokal.");
  return response.json() as Promise<ApplicantDashboardData>;
}

export async function getApplicantSelectionData() {
  if (!usesLocalBackend()) return (await import("@/features/selection/applicant")).getApplicantSelection();
  const response = await backendRequest("/v1/registration/selection");
  if (!response.ok) throw new Error("Gagal memuat seleksi dari backend lokal.");
  return response.json() as Promise<Awaited<ReturnType<typeof import("@/features/selection/applicant").getApplicantSelection>>>;
}

export async function getApplicantAttemptData(assignmentId: string) {
  if (!usesLocalBackend()) return (await import("@/features/selection/applicant")).getApplicantAttempt(assignmentId);
  const response = await backendRequest(`/v1/registration/selection/${encodeURIComponent(assignmentId)}`);
  if (response.status === 404) throw new Error("Tes tidak ditemukan.");
  if (!response.ok) throw new Error("Gagal memuat tes dari backend lokal.");
  return response.json() as Promise<Awaited<ReturnType<typeof import("@/features/selection/applicant").getApplicantAttempt>>>;
}
