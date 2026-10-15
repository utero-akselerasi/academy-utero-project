import { backendRequest } from "@/lib/backend/server";

async function request(path: string, options?: RequestInit) {
  const response = await backendRequest(path, options);
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Backend lokal gagal memproses permintaan.");
  return response.json();
}

export const getLocalApplications = () => request("/v1/admin/applications");
export const getLocalPlacements = () => request("/v1/admin/placements");
export const updateLocalApplication = (id: string, body: object) => request(`/v1/admin/applications/${id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
export const approveLocalOnboarding = (id: string) => request(`/v1/admin/applications/${id}/approve-onboarding`, { method: "POST" });
export const createLocalPlacement = (body: object) => request("/v1/admin/placements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
export const deleteLocalPlacement = (id: string) => request(`/v1/admin/placements/${id}`, { method: "DELETE" });
