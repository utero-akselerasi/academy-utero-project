"use server";

import { backendRequest, usesLocalBackend } from "@/lib/backend/server";

export async function acceptInvitationAction(_: { ok: boolean; message: string }, formData: FormData) {
  if (!usesLocalBackend()) return { ok: false, message: "Undangan ini hanya berlaku untuk backend lokal." };
  const token = formData.get("token");
  const password = formData.get("password");
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) || typeof password !== "string" || password.length < 12 || password.length > 128) {
    return { ok: false, message: "Tautan atau password tidak valid (minimal 12 karakter)." };
  }
  try {
    const response = await backendRequest("/v1/auth/accept-invitation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password }) });
    return response.ok ? { ok: true, message: "Password tersimpan. Silakan masuk." } : { ok: false, message: "Tautan kedaluwarsa atau tidak berlaku." };
  } catch {
    return { ok: false, message: "Backend belum siap. Coba lagi." };
  }
}
