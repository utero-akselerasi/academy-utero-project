import { backendRequest } from "@/lib/backend/server";

export async function schoolBackend<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await backendRequest(`/v1/school${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || `School API gagal (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export function mapLocalApplication(row: any) {
  return {
    id: row.id, fullName: row.full_name, email: row.email, phone: row.phone,
    studentNumber: row.student_number, major: row.major, motivation: row.motivation,
    status: row.status, selectionStatus: row.selection_status ?? "not_assigned",
    onboardingStatus: row.onboarding_status ?? "not_started", proposedStartDate: row.proposed_start_date,
    proposedEndDate: row.proposed_end_date, createdAt: row.created_at, updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at, applicantUserId: row.applicant_user_id,
  };
}
