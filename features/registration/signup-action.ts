"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const signupSchema = z.object({
  fullName: z.string().trim().min(3).max(150),
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  message: "Konfirmasi password tidak cocok.", path: ["confirmPassword"],
});

export type SignupState = { ok: boolean; message: string };

export async function signupApplicantAction(_: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"), email: formData.get("email"),
    password: formData.get("password"), confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data akun tidak valid." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email, password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName, source_app: "utero_academy_applicant" } },
  });
  if (error) {
    console.error("Gagal membuat akun pelamar:", error);
    return { ok: false, message: "Akun belum dapat dibuat. Periksa data atau coba lagi nanti." };
  }
  return { ok: true, message: "Periksa email verifikasi, lalu login untuk melanjutkan pendaftaran." };
}
