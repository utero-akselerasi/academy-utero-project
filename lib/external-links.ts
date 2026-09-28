/**
 * Validasi URL eksternal yang dimasukkan pengguna dan **dirender sebagai tautan
 * yang bisa diklik orang lain**.
 *
 * Kenapa berkas ini ada: `daily_report_attachments` menerima link Google Drive
 * sebagai ganti unggahan berkas (`mime_type: "url"`), dan pemeriksaan lamanya
 * adalah pencarian substring:
 *
 * ```ts
 * link.includes("google.com") || link.includes("drive.google.com")
 * ```
 *
 * Itu bukan pemeriksaan host. Semuanya lolos:
 *
 * - `http://google.com.penyerang.net/muatan` — `google.com` cuma awalan hostname
 * - `https://jahat.com/?x=google.com` — ada di query string
 * - `https://jahat.com/#google.com` — ada di fragment
 * - `javascript:alert(1)//google.com` — bukan HTTP sama sekali
 *
 * Nilainya tersimpan sebagai `file_path`, lalu dirender jadi tautan yang **diklik
 * pembimbing** saat mereview laporan. Jadi kesalahannya bukan cuma data kotor —
 * ia jalur phishing ke akun yang punya hak lebih tinggi dari pengirimnya.
 *
 * Aturan di sini: parse dengan `URL`, wajib `https:`, dan hostname harus **sama
 * persis** dengan salah satu host di allowlist. Bukan `endsWith`, karena
 * `endsWith(".google.com")` tetap menerima host mana pun di bawah domain itu,
 * termasuk yang menyajikan konten buatan pengguna.
 */

/**
 * Host yang boleh. Sengaja sempit: cuma dua bentuk yang benar-benar dipakai
 * pengguna untuk membagikan berkas Drive.
 *
 * `drive.usercontent.google.com` **tidak** dimasukkan meski itu host Google asli.
 * Host itu menyajikan byte berkas mentah, bukan halaman pratinjau, dan tautannya
 * berumur pendek — jadi menyimpannya di DB menghasilkan tautan mati, bukan akses.
 */
const HOST_DIIZINKAN = new Set(["drive.google.com", "docs.google.com"]);

/**
 * `true` hanya untuk URL `https:` yang hostname-nya persis ada di allowlist.
 *
 * Bentuknya predikat, bukan pelempar error, karena dipakai di dua tempat dengan
 * kebutuhan berbeda: server action menolak dengan pesan, dan form klien
 * menonaktifkan tombol. Keduanya harus memakai fungsi yang **sama** — pemeriksaan
 * klien yang berbeda dari pemeriksaan server adalah cara lubang ini lahir.
 */
export function isAllowedDriveLink(nilai: string | null | undefined): boolean {
  if (typeof nilai !== "string") return false;

  const dipangkas = nilai.trim();
  if (dipangkas === "") return false;

  let url: URL;
  try {
    url = new URL(dipangkas);
  } catch {
    // Bukan URL absolut. Termasuk `drive.google.com/file/d/abc` tanpa skema —
    // ditolak dengan sengaja: menambahkan `https://` sendiri berarti menebak
    // maksud pengguna, dan tebakan itu bisa mengubah host yang dituju.
    return false;
  }

  // `https:` saja. `http:` ditolak karena tautannya diklik orang lain, dan
  // skema lain (`javascript:`, `data:`, `file:`) ditolak karena berbahaya —
  // `new URL()` menerima semuanya tanpa keluhan, jadi pemeriksaan ini yang
  // menanggungnya.
  if (url.protocol !== "https:") return false;

  // `URL` sudah menormalkan hostname (huruf kecil, punycode), jadi
  // `DRIVE.GOOGLE.COM` dan `drive.google.com.` cocok, sementara
  // `google.com.penyerang.net` tidak.
  return HOST_DIIZINKAN.has(url.hostname.replace(/\.$/, ""));
}

/** Daftar host, untuk ditampilkan di pesan galat dan teks bantuan form. */
export const HOST_DRIVE_DIIZINKAN = [...HOST_DIIZINKAN];
