"use server";

import { backendRequest, usesLocalBackend } from "@/lib/backend/server";

export type VerifyEmailState = { ok: boolean; message: string };

export async function verifyEmailAction(_: VerifyEmailState, formData: FormData): Promise<VerifyEmailState> {
  if (!usesLocalBackend()) return { ok: false, message: "Verifikasi lokal tidak aktif." };
  const token = String(formData.get("token") || "").trim();
  if (!/^[a-f0-9]{64}$/.test(token)) return { ok: false, message: "Tautan verifikasi tidak valid." };
  try {
    const response = await backendRequest("/v1/auth/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) return { ok: false, message: "Tautan sudah digunakan atau kedaluwarsa." };
    return { ok: true, message: "Email terverifikasi. Sekarang kamu dapat login." };
  } catch {
    return { ok: false, message: "Backend belum siap. Coba lagi nanti." };
  }
}

export async function resendVerificationAction(_: VerifyEmailState, formData: FormData): Promise<VerifyEmailState> {
  if (!usesLocalBackend()) return { ok: false, message: "Verifikasi lokal tidak aktif." };
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email || email.length > 320) return { ok: false, message: "Email tidak valid." };
  try {
    const response = await backendRequest("/v1/auth/resend-verification", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) return { ok: false, message: "Email verifikasi gagal dikirim. Coba lagi nanti." };
    return { ok: true, message: "Permintaan diterima. Jika akun memenuhi syarat, email verifikasi akan dikirim." };
  } catch {
    return { ok: false, message: "Backend belum siap. Coba lagi nanti." };
  }
}
