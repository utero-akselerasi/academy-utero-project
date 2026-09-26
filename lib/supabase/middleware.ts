import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { assertSupabaseEnv, hasSupabaseEnv } from "./config";

/**
 * `extraRequestHeaders` diteruskan ke setiap NextResponse.next() di bawah.
 *
 * Dipakai proxy.ts untuk menitipkan header Content-Security-Policy berisi nonce
 * ke request: Next.js membaca nonce dari header request itu untuk dipasang ke
 * script bootstrap-nya sendiri. Header dibangun ulang dari request.headers
 * setiap kali, bukan sekali di awal, karena request.cookies.set() di bawah
 * memutakhirkan header cookie pada request - kalau headernya di-snapshot lebih
 * dahulu, sesi yang baru disegarkan tidak ikut terkirim ke Server Component.
 */
export async function updateSession(
  request: NextRequest,
  extraRequestHeaders?: Record<string, string>,
) {
  const forwardedHeaders = () => {
    const headers = new Headers(request.headers);
    for (const [key, value] of Object.entries(extraRequestHeaders ?? {})) {
      headers.set(key, value);
    }
    return headers;
  };

  let response = NextResponse.next({
    request: { headers: forwardedHeaders() },
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
          request: { headers: forwardedHeaders() },
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
