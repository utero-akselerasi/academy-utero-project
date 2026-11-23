import { backendRequest } from "@/lib/backend/server";

async function request(path: string, options?: RequestInit) {
  const response = await backendRequest(path, options);
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Backend lokal gagal memproses permintaan.");
  return response.json();
}

export const getLocalApplications = () => request("/v1/admin/applications");
export const getLocalApplicationSelection = (id: string) => request(`/v1/admin/applications/${encodeURIComponent(id)}/selection`) as Promise<{ assignments: Array<{ id: string; status: string; assigned_at: string; title: string; attempt_status: string | null; started_at: string | null; submitted_at: string | null; expires_at: string | null }> }>;
export const getLocalActiveInterns = () => request("/v1/admin/interns") as Promise<{ interns: any[] }>;
export const updateLocalApplication = (id: string, body: object) => request(`/v1/admin/applications/${id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
export const approveLocalOnboarding = (id: string) => request(`/v1/admin/applications/${id}/approve-onboarding`, { method: "POST" });
