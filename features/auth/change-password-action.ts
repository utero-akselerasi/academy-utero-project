"use server";

import { requireUser } from "@/features/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { backendRequest, setBackendSession, usesLocalBackend } from "@/lib/backend/server";

export type ChangePasswordFormState = {
  ok: boolean;
  message: string;
};

export async function changePasswordAction(_: ChangePasswordFormState, formData: FormData): Promise<ChangePasswordFormState> {
  // Aksi self-service: hanya mengubah password milik sesi yang aktif.
  const user = await requireUser();

  const email = user.email;
  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // Validasi
  if (!currentPassword || !newPassword || !confirmPassword) {
    return { ok: false, message: "Semua field wajib diisi." };
  }

  const minimumLength = usesLocalBackend() ? 12 : 8;
  if (newPassword.length < minimumLength) {
    return { ok: false, message: `Password baru minimal ${minimumLength} karakter.` };
  }

  if (newPassword !== confirmPassword) {
    return { ok: false, message: "Password baru tidak cocok dengan konfirmasi." };
  }

  if (currentPassword === newPassword) {
    return { ok: false, message: "Password baru harus berbeda dari password lama." };
  }

  if (!email) {
    return { ok: false, message: "Email akun tidak ditemukan." };
  }

  if (usesLocalBackend()) {
    try {
      const response = await backendRequest("/v1/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (response.status === 401) return { ok: false, message: "Password lama Anda tidak sesuai." };
      if (response.status === 400) return { ok: false, message: "Password baru belum memenuhi ketentuan." };
      if (!response.ok) return { ok: false, message: "Gagal mengubah password. Coba lagi." };
      await setBackendSession(response);
      return { ok: true, message: "Password berhasil diubah." };
    } catch (error) {
      console.error("Gagal ubah password melalui backend lokal:", error);
      return { ok: false, message: "Gagal mengubah password. Coba lagi." };
    }
  }

  // Verifikasi password lama dengan login ulang
  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (signInError) {
    return { ok: false, message: "Password lama Anda tidak sesuai." };
  }

  // Update password
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    console.error("Gagal ubah password:", error);
    return { ok: false, message: "Gagal mengubah password. Coba lagi." };
  }

  return { ok: true, message: "Password berhasil diubah." };
}
