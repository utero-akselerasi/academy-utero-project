"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { backendRequest, usesLocalBackend } from "@/lib/backend/server";
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

  if (usesLocalBackend()) {
    try {
      const response = await backendRequest("/v1/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: parsed.data.fullName,
          email: parsed.data.email,
          password: parsed.data.password,
        }),
      });
      if (response.status === 409) {
        return { ok: false, message: "Akun belum dapat dibuat. Periksa data atau gunakan akun yang sudah ada." };
      }
      if (!response.ok) return { ok: false, message: "Akun belum dapat dibuat. Coba lagi nanti." };
      return { ok: true, message: "Akun dibuat. Periksa email untuk membuka tautan verifikasi sebelum login." };
    } catch (error) {
      console.error("Gagal membuat akun pelamar pada backend lokal:", error);
      return { ok: false, message: "Backend belum siap. Coba lagi nanti." };
    }
  }

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
