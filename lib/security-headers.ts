/**
 * Header keamanan tingkat respons, terutama Content-Security-Policy.
 *
 * Aplikasi ini merender HTML kaya yang ditulis staf (artikel blog publik dan
 * materi LMS). lib/sanitize.ts sudah membuang tag dan atribut berbahaya, tapi
 * sanitasi adalah satu lapis yang bisa dilewati kalau nanti ada sink innerHTML
 * baru yang lupa memanggilnya. CSP jadi lapis kedua: script tanpa nonce tidak
 * dieksekusi browser sekalipun berhasil masuk ke dalam dokumen.
 *
 * Dipasang dari proxy.ts, bukan dari file middleware terpisah: Next.js 16 hanya
 * mengizinkan satu di antara proxy.ts dan middleware.ts.
 */

function supabaseOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

export function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  const directives: string[] = [
    "default-src 'self'",
    // 'strict-dynamic' membuat script yang dimuat oleh script ber-nonce ikut
    // dipercaya, sehingga chunk Next.js tetap jalan tanpa 'unsafe-inline'.
    // 'unsafe-eval' hanya di dev: react-refresh membutuhkannya.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Next dan Tailwind menyuntikkan <style> inline saat render, dan halaman
    // cetak memakai blok @media print inline. Pelonggaran dibatasi ke style
    // saja - style-src tidak bisa mengeksekusi kode.
    "style-src 'self' 'unsafe-inline'",
    // Gambar bisa dari storage Supabase, cover artikel CMS di host lain, serta
    // data:/blob: untuk pratinjau unggahan sebelum terkirim.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    ["connect-src 'self'", supabaseOrigin(), isDev ? "ws: wss:" : ""].filter(Boolean).join(" "),
    // Peta OpenStreetMap (kontak & review absensi), video materi YouTube, dan
    // pratinjau PDF dari origin sendiri atau blob.
    "frame-src 'self' blob: https://www.openstreetmap.org https://www.youtube.com https://www.youtube-nocookie.com",
    "media-src 'self' blob: https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];

  return directives.join("; ");
}

export function applySecurityHeaders(headers: Headers, csp: string, isDev: boolean) {
  headers.set("content-security-policy", csp);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-frame-options", "DENY");
  headers.set(
    "permissions-policy",
    "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()",
  );

  // HSTS hanya di produksi: di dev aplikasi diakses lewat http dan header ini
  // akan mengunci browser ke https untuk localhost.
  if (!isDev) {
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  }
}
