"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getPrimaryDashboardPath } from "./roles";

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

  let userId: string | undefined;
  let error;

  try {
    const supabase = await createSupabaseServerClient();
    const result = await supabase.auth.signInWithPassword(parsed.data);
    userId = result.data.user?.id;
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

  if (!userId) {
    return {
      ok: false,
      message: "Login berhasil, tetapi data user tidak ditemukan.",
    };
  }

  const dashboardPath = await getPrimaryDashboardPath(userId);

  if (!dashboardPath) {
    return {
      ok: false,
      message: "User belum memiliki role. Hubungi Super Admin.",
    };
  }

  redirect(dashboardPath);
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
