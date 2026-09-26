import { NextResponse } from "next/server";
import { applySecurityHeaders, buildContentSecurityPolicy } from "@/lib/security-headers";

/**
 * Endpoint liveness untuk healthcheck container.
 *
 * Sengaja **tidak** menyentuh database, Supabase, atau layanan luar apa pun.
 * Healthcheck Docker menentukan apakah container di-restart: kalau endpoint ini
 * ikut memanggil database, satu gangguan sesaat di database akan membuat Docker
 * me-restart aplikasi yang sebenarnya sehat — dan restart itu tidak memperbaiki
 * database, jadi yang didapat cuma loop restart saat gangguan.
 *
 * Yang dibuktikan endpoint ini cuma satu: proses Next.js hidup dan bisa
 * melayani permintaan. Kesehatan dependensi adalah urusan monitoring, bukan
 * urusan keputusan restart.
 *
 * Responsnya **tidak memuat versi, commit, nama host, atau isi environment.**
 * Endpoint ini tak terautentikasi dan terekspos ke internet lewat nginx, jadi
 * apa pun yang dikembalikannya bisa dibaca siapa saja — dan versi paket adalah
 * informasi yang memudahkan pemilihan exploit.
 */

// Jangan pernah di-cache: respons ter-cache akan melaporkan "sehat" dari
// container yang sudah mati.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const response = NextResponse.json({ status: "ok" }, { status: 200 });

  response.headers.set("cache-control", "no-store, no-cache, must-revalidate");

  // Route ini dikecualikan dari matcher proxy.ts (supaya healthcheck tidak
  // bergantung pada Supabase), jadi header keamanan yang biasanya dipasang di
  // sana harus dipasang sendiri di sini. Nonce-nya tidak dipakai — responsnya
  // JSON, bukan HTML — tapi CSP tetap dikirim supaya pengecualian matcher tidak
  // sekalian jadi pengecualian header.
  const isDev = process.env.NODE_ENV !== "production";
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  applySecurityHeaders(response.headers, buildContentSecurityPolicy(nonce, isDev), isDev);

  return response;
}
