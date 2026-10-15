"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { backendRequest, clearBackendSession, setBackendSession, usesLocalBackend } from "@/lib/backend/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getPrimaryDashboardPath, getPrimaryDashboardPathForRoles, isActiveRoleCode } from "./roles";

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

  if (usesLocalBackend()) {
    let dashboardPath: string;
    try {
      const response = await backendRequest("/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (response.status === 401) return { ok: false, message: "Email atau password tidak sesuai." };
      if (response.status === 403) return { ok: false, message: "User belum memiliki role. Hubungi Super Admin." };
      if (!response.ok) return { ok: false, message: "Backend belum siap. Coba lagi." };
      const body = await response.clone().json() as { user?: { roles?: string[] } };
      const roles = (body.user?.roles ?? []).filter(isActiveRoleCode);
      const destination = getPrimaryDashboardPathForRoles(roles);
      if (!destination) return { ok: false, message: "User belum memiliki role. Hubungi Super Admin." };
      await setBackendSession(response);
      dashboardPath = destination;
    } catch (error) {
      console.error("Login backend lokal gagal:", error);
      return { ok: false, message: "Backend belum siap. Coba lagi." };
    }
    redirect(dashboardPath);
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

  const cookieStore = await cookies();
  cookieStore.set("utero-login-day", new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect(dashboardPath);
}

export async function logoutAction() {
  if (usesLocalBackend()) {
    const response = await backendRequest("/v1/auth/logout", { method: "POST" });
    if (!response.ok) throw new Error("Gagal mencabut sesi backend lokal.");
    await clearBackendSession();
    redirect("/login");
  }
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
