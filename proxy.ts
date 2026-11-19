import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { applySecurityHeaders, buildContentSecurityPolicy } from "@/lib/security-headers";

/**
 * Proxy header keamanan untuk runtime backend mandiri.
 *
 * Header keamanan dipasang di sini karena Next.js 16 hanya mengizinkan satu di
 * antara proxy.ts dan middleware.ts.
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
  const forwarded = { "x-nonce": nonce, "content-security-policy": csp };
  const requestHeaders = new Headers(request.headers);
  for (const [name, value] of Object.entries(forwarded)) requestHeaders.set(name, value);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  applySecurityHeaders(response.headers, csp, isDev);

  return response;
}

/**
 * `api/health` dikecualikan dengan sengaja.
 *
 * Healthcheck dikecualikan agar hanya menguji proses Next.js tanpa bergantung
 * pada database atau API internal.
 *
 * Endpoint itu memasang header keamanannya sendiri; lihat catatan di sana.
 */
export const config = {
  matcher: [
    "/((?!api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
