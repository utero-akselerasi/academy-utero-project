import { cookies } from "next/headers";

export type BackendIdentity = {
  id: string;
  email: string | null;
  fullName?: string | null;
  roles: string[];
  permissions: string[];
};

const SESSION_COOKIE = "utero_session";

export function usesLocalBackend() {
  return process.env.ACADEMY_BACKEND_MODE === "local";
}

function backendUrl(path: string) {
  const base = process.env.ACADEMY_API_INTERNAL_URL;
  if (!base) throw new Error("ACADEMY_API_INTERNAL_URL wajib diisi untuk backend lokal.");
  return new URL(path, `${base.replace(/\/$/, "")}/`);
}

export async function backendRequest(path: string, options: RequestInit = {}) {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  const headers = new Headers(options.headers);
  if (cookie) headers.set("cookie", `${SESSION_COOKIE}=${encodeURIComponent(cookie)}`);
  return fetch(backendUrl(path), {
    ...options,
    headers,
    cache: "no-store",
    signal: options.signal ?? AbortSignal.timeout(10_000),
  });
}

export async function getBackendIdentity(): Promise<BackendIdentity | null> {
  const response = await backendRequest("/v1/auth/me");
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Gagal memvalidasi sesi backend lokal.");
  const body = await response.json() as { user: BackendIdentity };
  return body.user;
}

export async function setBackendSession(response: Response) {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const token = /^utero_session=([A-Za-z0-9_-]{43})(?:;|$)/.exec(setCookie)?.[1];
  const ttl = /(?:^|;)\s*Max-Age=(\d+)/i.exec(setCookie)?.[1];
  if (!token || !ttl) throw new Error("Respons backend tidak memiliki cookie sesi valid.");
  const maxAge = Number(ttl);
  if (!Number.isSafeInteger(maxAge) || maxAge < 1 || maxAge > 31 * 86400) {
    throw new Error("TTL sesi backend tidak valid.");
  }
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.ACADEMY_SECURE_COOKIES !== "false",
    path: "/",
    maxAge,
  });
}

export async function clearBackendSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
