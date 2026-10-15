import { backendRequest } from "@/lib/backend/server";

async function localRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await backendRequest(path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `Backend assessment gagal (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export async function localAssessmentInterns() {
  return (await localRequest<{ interns: any[] }>("/v1/assessments/interns")).interns;
}

export async function localInternAssessment(internId: string) {
  return (await localRequest<{ assessment: any | null }>(`/v1/assessments/${encodeURIComponent(internId)}`)).assessment;
}

export async function localAssessmentSettings() {
  return (await localRequest<{ settings: any }>("/v1/assessments/settings")).settings;
}

export async function localSaveAssessment(internId: string, body: object) {
  return localRequest(`/v1/assessments/${encodeURIComponent(internId)}`, {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

export async function localCertificate(internId: string) {
  const response = await backendRequest(`/v1/certificates/${encodeURIComponent(internId)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Gagal membaca sertifikat lokal.");
  return ((await response.json()) as { certificate: any }).certificate;
}

export async function localCertificateContext(internId: string) {
  return localRequest<{ internProfile: any; settings: { certificate_template_path: string | null } | null; templateUrl?: string }>(
    `/v1/certificates/${encodeURIComponent(internId)}/context`,
  );
}

export async function uploadLocalCertificateTemplate(path: string, file: File) {
  const form = new FormData();
  form.set("file", file, file.name);
  await localRequest("/v1/storage/academy-private", { method: "POST", headers: { "x-object-path": path }, body: form });
  await localRequest("/v1/assessments/settings/certificate-template", {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ path }),
  });
}
