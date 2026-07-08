"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type ChangePasswordFormState = {
  ok: boolean;
  message: string;
};

export async function changePasswordAction(_: ChangePasswordFormState, formData: FormData): Promise<ChangePasswordFormState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const email = user.email;
  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // Validasi
  if (!currentPassword || !newPassword || !confirmPassword) {
    return { ok: false, message: "Semua field wajib diisi." };
  }

  if (newPassword.length < 8) {
    return { ok: false, message: "Password baru minimal 8 karakter." };
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

  // Verifikasi password lama dengan login ulang
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
