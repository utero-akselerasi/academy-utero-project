import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { applySecurityHeaders, buildContentSecurityPolicy } from "@/lib/security-headers";

/**
 * Penyegaran sesi Supabase + header keamanan respons.
 *
 * Header keamanan dipasang di sini karena Next.js 16 hanya mengizinkan satu di
 * antara proxy.ts dan middleware.ts, dan penyegaran sesi sudah lebih dulu ada
 * di sini.
 *
 * Proxy ini SENGAJA tidak menegakkan otorisasi. Otorisasi ada di setiap page,
 * Server Action, dan route handler lewat features/auth/guards.ts - memindahkannya
 * ke satu titik proxy akan membuatnya gampang terlewat dan tidak berlaku untuk
 * pemanggilan Server Action lewat action ID, yang tidak lewat pencocokan path.
 */
export async function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildContentSecurityPolicy(nonce, isDev);

  // Nonce dititipkan lewat header request: Next.js membacanya dari sana untuk
  // dipasang ke script bootstrap-nya sendiri, jadi script-src tidak perlu
  // 'unsafe-inline'.
  const response = await updateSession(request, {
    "x-nonce": nonce,
    "content-security-policy": csp,
  });

  applySecurityHeaders(response.headers, csp, isDev);

  return response;
}

/**
 * `api/health` dikecualikan dengan sengaja.
 *
 * `updateSession()` memanggil `supabase.auth.getUser()` — satu permintaan
 * jaringan ke Supabase — untuk setiap path yang cocok. Kalau healthcheck
 * container ikut lewat sini, gangguan sesaat di Supabase akan membuat Docker
 * menganggap aplikasi mati lalu me-restart-nya, padahal restart tidak
 * memperbaiki Supabase. Yang didapat cuma loop restart saat gangguan.
 *
 * Endpoint itu memasang header keamanannya sendiri; lihat catatan di sana.
 */
export const config = {
  matcher: [
    "/((?!api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
