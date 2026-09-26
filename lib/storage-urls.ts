import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * Satu-satunya tempat yang mengubah nilai kolom storage di database menjadi URL
 * yang bisa dirender.
 *
 * ## Kenapa modul ini ada
 *
 * Migrasi `0007_setup_buckets_and_permissions.sql` memaksa keenam bucket jadi
 * `public = true` dan memasang policy `Public Access` `using (true)` di
 * `storage.objects`. Akibatnya terbukti empiris: mengambil
 * `check_in_selfie_path` peserta **tanpa header auth sama sekali** mengembalikan
 * HTTP 200 dan berkas JPEG-nya. Selfie absensi, surat keterangan sakit, CV, dan
 * portofolio pelamar semuanya terbaca siapa pun yang tahu path-nya.
 *
 * Perbaikannya: bucket sensitif dijadikan privat, kolom DB menyimpan **object
 * path** (bukan URL), dan pembacaan lewat **signed URL** yang dibuat di server.
 *
 * ## Yang bikin ini tidak sesederhana "tanda tangani semuanya"
 *
 * 1. **Bucket publik harus TETAP publik.** `article`, `gallery`, `mentor`, dan
 *    `school-logo` dirender di landing page yang di-cache (`revalidatePath("/")`)
 *    dan dibaca tanpa sesi. Signed URL ber-TTL justru merusak cache: HTML
 *    ter-cache akan menyimpan token yang lalu kedaluwarsa. Jadi bucket itu
 *    dilayani `getPublicUrl()`, tanpa token.
 *
 * 2. **`avatars` adalah keranjang campur.** Di dalamnya ada avatar profil
 *    bersama `cv`, `portfolio`, selfie absensi, surat sakit, dan template
 *    sertifikat. Satu flag `public` tidak bisa memisahkan keduanya, jadi seluruh
 *    bucket dijadikan privat — artinya avatar profil pun ikut butuh tanda tangan.
 *
 * 3. **Database masih berisi URL publik penuh.** Backfill (B0.3b) menulis ulang
 *    baris produksi dan butuh izin terpisah, jadi ia belum jalan. Sampai jalan,
 *    satu kolom bisa berisi URL penuh (baris lama) **atau** object path (baris
 *    baru). `resolveStorageUrl` menerima keduanya — tanpa toleransi ini, setiap
 *    gambar lama mati begitu kode ini naik. Lihat `toObjectPath`.
 *
 * ## Yang TIDAK ditangani di sini
 *
 * Tiga kolom `file_path` bukan objek storage dan tidak boleh lewat modul ini:
 * `school_reports.file_path` (route aplikasi), `certificates.file_path` (selalu
 * null, tak pernah ditulis), dan `daily_report_attachments.file_path` saat
 * `mime_type = "url"` (tautan Google Drive).
 */

/** Bucket yang dipakai aplikasi. */
export type StorageBucket =
  | "avatars"
  | "daily-report"
  | "task"
  | "certificate"
  | "learning"
  | "gallery"
  | "article"
  | "mentor"
  | "school-logo";

/**
 * Bucket yang tetap dibaca publik tanpa tanda tangan.
 *
 * Isinya memang konten publik, dirender di halaman yang di-cache dan dibaca
 * tanpa sesi. Menandatanganinya akan menaruh token ber-TTL di dalam HTML yang
 * ter-cache. Daftar ini harus cocok dengan predikat `public_buckets_read` di
 * `0032a_storage_hardening.sql` — kalau berbeda, gambar akan mati atau justru
 * bocor.
 */
const PUBLIC_BUCKETS = new Set<StorageBucket>(["gallery", "article", "mentor", "school-logo"]);

export function isPublicBucket(bucket: StorageBucket): boolean {
  return PUBLIC_BUCKETS.has(bucket);
}

/**
 * Masa berlaku tanda tangan.
 *
 * `default` sengaja pendek: URL-nya hanya perlu hidup selama satu render
 * halaman. `print` jauh lebih panjang karena halaman cetak sertifikat
 * menyuntikkan URL ke `background-image` CSS, dan rasterisasi cetak bisa mulai
 * lama setelah HTML dikirim — TTL pendek akan menghasilkan sertifikat tanpa
 * latar.
 */
export const SIGNED_URL_TTL = {
  default: 60 * 60, // 1 jam
  print: 60 * 60 * 6, // 6 jam
} as const;

/**
 * Mengubah nilai kolom database menjadi object path.
 *
 * Menerima tiga bentuk karena ketiganya benar-benar ada di produksi selama masa
 * transisi:
 *
 * - object path (`"uuid/attendance_in/uuid.jpg"`) — bentuk tujuan, dikembalikan apa adanya
 * - URL publik lama (`".../storage/v1/object/public/avatars/<path>"`) — prefix dipangkas
 * - URL bertanda tangan (`".../object/sign/avatars/<path>?token=..."`) — bisa
 *   tersimpan tak sengaja lewat `hero_image_path`, yang bolak-balik lewat input
 *   tersembunyi di `LandingPageEditor`. Ditangani supaya baris yang sudah
 *   tercemar tetap bisa dirender.
 *
 * Pencocokan memakai pola `/object/(public|sign)/<bucket>/`, **bukan** perbandingan
 * dengan `NEXT_PUBLIC_SUPABASE_URL`. Base URL-nya pernah berubah (dan contoh env
 * memakai `http://` sedangkan produksi `https://`), jadi mencocokkan base akan
 * gagal senyap untuk baris yang ditulis dengan base lama.
 */
export function toObjectPath(value: string | null | undefined, bucket: StorageBucket): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const marker = trimmed.match(
    new RegExp(`/storage/v1/object/(?:public|sign|authenticated)/${bucket}/`),
  );

  if (marker) {
    const path = trimmed.slice((marker.index ?? 0) + marker[0].length);
    // Buang query string tanda tangan; `?` tidak pernah sah di object path.
    const withoutQuery = path.split("?")[0];
    const decoded = safeDecode(withoutQuery);
    return decoded ? decoded.replace(/^\/+/, "") : null;
  }

  // Nilai berbentuk URL tapi bucket-nya tidak cocok: jangan diterka. Ini
  // biasanya berarti pemanggil menyebut bucket yang salah, dan menandatanganinya
  // dengan bucket keliru akan menghasilkan 404 yang membingungkan.
  if (/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  return trimmed.replace(/^\/+/, "");
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    // Path dengan `%` literal yang tidak valid sebagai escape. Pakai apa adanya.
    return value;
  }
}

/**
 * URL siap render untuk satu nilai kolom storage.
 *
 * Mengembalikan `null` kalau nilainya kosong, bukan objek storage yang dikenal,
 * atau penandatanganannya gagal. Tipe kembalian `string | null` disengaja: ia
 * memaksa setiap titik render menangani kasus "gambar tidak ada" secara
 * eksplisit, dan `tsc` akan menolak meneruskannya ke prop `src: string`.
 *
 * Hanya boleh dipanggil di server — ia memakai kunci service role.
 */
export async function resolveStorageUrl(
  bucket: StorageBucket,
  value: string | null | undefined,
  options: { expiresIn?: number } = {},
): Promise<string | null> {
  const objectPath = toObjectPath(value, bucket);
  if (!objectPath) return null;

  const supabase = createSupabaseServiceRoleClient();

  if (isPublicBucket(bucket)) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    return data?.publicUrl ?? null;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, options.expiresIn ?? SIGNED_URL_TTL.default);

  if (error || !data?.signedUrl) {
    // Objek yatim (baris DB ada, berkasnya tidak) bukan hal aneh di data ini:
    // repo tidak punya satu pun `storage.remove()`, jadi penghapusan baris
    // selalu meninggalkan objek — dan sebaliknya, path yang salah tulis
    // meninggalkan baris tanpa objek. Dicatat, lalu dilewati; satu gambar hilang
    // tidak boleh menggagalkan seluruh halaman.
    console.error(`Gagal menandatangani ${bucket}/${objectPath}:`, error?.message ?? "URL kosong");
    return null;
  }

  return data.signedUrl;
}

/**
 * Versi banyak nilai sekaligus, ditandatangani paralel.
 *
 * Dipakai di halaman daftar. `app/dashboard/mentor/attendance/page.tsx` merender
 * sampai empat lampiran per baris absensi; menandatanganinya berurutan membuat
 * latensi halaman itu naik sebanding jumlah baris.
 *
 * Urutan keluaran sama dengan masukan, dan tiap elemen bisa `null` — jadi
 * indeksnya tetap bisa dipasangkan dengan sumbernya.
 */
export async function resolveStorageUrls(
  bucket: StorageBucket,
  values: Array<string | null | undefined>,
  options: { expiresIn?: number } = {},
): Promise<Array<string | null>> {
  return Promise.all(values.map((value) => resolveStorageUrl(bucket, value, options)));
}

/**
 * Apakah objek ini PDF, dinilai dari **object path**.
 *
 * Titik render memilih antara `<a href>` dan `<ImagePreview>` berdasarkan
 * ekstensi. Sebelumnya cek itu dilakukan pada URL final dengan
 * `.endsWith(".pdf")` — yang **selalu false** begitu URL-nya bertanda tangan,
 * karena signed URL berakhir dengan `?token=...`. Akibatnya setiap PDF akan
 * dirender sebagai gambar rusak.
 *
 * Karena itu keputusan tipe harus diambil dari nilai kolom, sebelum
 * ditandatangani. Fungsi ini menerima URL lama juga, lewat `toObjectPath`.
 */
export function isPdfPath(value: string | null | undefined, bucket: StorageBucket): boolean {
  const objectPath = toObjectPath(value, bucket);
  if (!objectPath) return false;
  return objectPath.toLowerCase().endsWith(".pdf");
}

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

/**
 * Apakah objek ini gambar, dinilai dari **object path**.
 *
 * Pasangan `isPdfPath`, dan alasannya sama: titik render yang tidak punya kolom
 * `mime_type` untuk dipakai harus menebak dari ekstensi, dan ekstensi pada signed
 * URL selalu tertutup `?token=...`.
 *
 * Kalau baris yang dibaca punya `mime_type`, **pakai itu**, bukan fungsi ini —
 * ekstensi cuma tebakan, sedangkan `mime_type` ditulis dari hasil `validateUpload`
 * yang memeriksa isi berkas.
 */
export function isImagePath(value: string | null | undefined, bucket: StorageBucket): boolean {
  const objectPath = toObjectPath(value, bucket);
  if (!objectPath) return false;
  const ext = objectPath.split(".").pop()?.toLowerCase();
  return IMAGE_EXTENSIONS.has(ext || "");
}
