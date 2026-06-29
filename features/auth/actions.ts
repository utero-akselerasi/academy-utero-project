"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email tidak valid."),
  password: z.string().min(1, "Password wajib diisi."),
});

export async function loginAction(_: unknown, formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Data login tidak valid.",
    };
  }

  let error;

  try {
    const supabase = await createSupabaseServerClient();
    const result = await supabase.auth.signInWithPassword(parsed.data);
    error = result.error;
  } catch {
    return {
      ok: false,
      message: "Koneksi Supabase belum siap. Isi env Supabase sebelum login.",
    };
  }

  if (error) {
    return {
      ok: false,
      message: "Email atau password tidak sesuai.",
    };
  }

  redirect("/dashboard/admin/pendaftaran");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
