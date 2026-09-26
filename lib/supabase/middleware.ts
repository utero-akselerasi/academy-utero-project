import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { assertSupabaseEnv, hasSupabaseEnv } from "./config";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  if (!hasSupabaseEnv()) {
    return response;
  }

  const loginDay = request.cookies.get("utero-login-day")?.value;
  const currentDay = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
  const isProtectedRoute = request.nextUrl.pathname.startsWith("/dashboard");

  if (isProtectedRoute && loginDay !== currentDay) {
    response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("utero-login-day");
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")) {
        response.cookies.delete(cookie.name);
      }
    }
    return response;
  }

  const { supabaseUrl, supabaseAnonKey } = assertSupabaseEnv();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}
