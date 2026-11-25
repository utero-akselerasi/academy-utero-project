"use server";

import { backendRequest } from "@/lib/backend/server";
import { z } from "zod";

export type PasswordResetState = { ok: boolean; message: string };

export async function requestPasswordResetAction(_: PasswordResetState, formData: FormData): Promise<PasswordResetState> {
  const parsed = z.email().safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, message: "Masukkan alamat email yang valid." };
  try {
    const response = await backendRequest("/v1/auth/request-password-reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: parsed.data }),
    });
    if (!response.ok) return { ok: false, message: "Permintaan belum dapat diproses. Coba lagi nanti." };
    return { ok: true, message: "Jika email terdaftar, tautan atur ulang password akan dikirim. Periksa juga folder spam." };
  } catch {
    return { ok: false, message: "Layanan belum tersedia. Coba lagi nanti." };
  }
}

export async function resetPasswordAction(_: PasswordResetState, formData: FormData): Promise<PasswordResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (!/^[a-f0-9]{64}$/.test(token)) return { ok: false, message: "Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru." };
  if (password.length < 12 || password.length > 128) return { ok: false, message: "Password harus 12-128 karakter." };
  if (password !== confirmPassword) return { ok: false, message: "Konfirmasi password tidak sama." };
  try {
    const response = await backendRequest("/v1/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    if (response.status === 400) return { ok: false, message: "Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru." };
    if (!response.ok) return { ok: false, message: "Password belum dapat diubah. Coba lagi nanti." };
    return { ok: true, message: "Password berhasil diubah. Semua sesi lama telah ditutup. Silakan masuk kembali." };
  } catch {
    return { ok: false, message: "Layanan belum tersedia. Coba lagi nanti." };
  }
}
