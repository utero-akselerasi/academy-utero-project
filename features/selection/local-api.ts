import { backendRequest } from "@/lib/backend/server";

export async function selectionRequest(path: string, method = "GET", body?: object) {
  const response = await backendRequest(`/v1/selection/staff${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Backend seleksi lokal gagal memproses permintaan.");
  return response.json();
}
