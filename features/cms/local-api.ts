import { backendRequest } from "@/lib/backend/server";

export async function localCmsRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await backendRequest(path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `Backend CMS gagal (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function uploadLocalCmsFile(bucket: "gallery" | "article", path: string, file: File) {
  const form = new FormData();
  form.set("file", file, file.name);
  await localCmsRequest(`/v1/storage/${bucket}`, {
    method: "POST",
    headers: { "x-object-path": path },
    body: form,
  });
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return { path, url: `/api/storage/${bucket}/${encoded}` };
}
