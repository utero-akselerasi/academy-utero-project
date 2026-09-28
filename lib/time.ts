/**
 * Waktu operasional aplikasi: **Asia/Jakarta**, selalu eksplisit.
 *
 * Kenapa modul ini ada, dan kenapa bukan sekadar mengandalkan `TZ`:
 *
 * `Dockerfile` dan `docker-compose.yml` menyetel `TZ=Asia/Jakarta`, jadi di
 * container produksi `Date.prototype.getHours()` **memang** mengembalikan jam
 * Jakarta dan perhitungan telat saat ini benar. Tapi kebenaran absensi peserta
 * tidak boleh bergantung pada satu variabel lingkungan:
 *
 * - `TZ` yang hilang atau salah tidak memunculkan error apa pun. Hasilnya
 *   bukan kegagalan, melainkan **angka telat yang bergeser beberapa jam** dan
 *   tetap terlihat masuk akal di laporan.
 * - `npm run dev` dan `npm run build` di laptop pengembang tidak memuat
 *   `docker-compose.yml`, jadi jumlah telat yang terlihat saat pengembangan
 *   berbeda dari produksi tanpa ada yang salah secara kasat mata.
 * - CI, cron, dan runner satu-kali (mis. eksekusi migrasi) belum tentu mewarisi
 *   `TZ` yang sama.
 *
 * Jadi setiap tempat yang memetakan sebuah instan ke **jam dinding** atau
 * **tanggal kalender** harus menyebut zona waktunya sendiri. `TZ` di container
 * dipertahankan sebagai lapis kedua yang membuat log dan pesan error terbaca
 * dalam waktu setempat — bukan sebagai sumber kebenaran.
 *
 * Yang **tidak** termasuk urusan modul ini: format tampilan di komponen klien
 * (`toLocaleDateString` di berkas `"use client"`). Itu berjalan di browser
 * peserta dan memang wajar mengikuti zona perangkatnya.
 */

export const APP_TIME_ZONE = "Asia/Jakarta";

/**
 * Tanggal kalender (`YYYY-MM-DD`) menurut Asia/Jakarta.
 *
 * Locale `en-CA` dipilih bukan karena Kanada, tapi karena ia satu-satunya
 * locale umum yang formatnya persis ISO `YYYY-MM-DD`, sehingga hasilnya bisa
 * dibandingkan langsung dengan kolom `date` Postgres tanpa penyusunan ulang
 * string. Ini menggantikan empat salinan `Intl.DateTimeFormat` yang sebelumnya
 * tersebar di `features/attendance/actions.ts`, `features/attendance/queries.ts`,
 * `features/auth/scope.ts`, dan `app/dashboard/mentor/attendance/page.tsx`.
 */
export function jakartaDateString(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * Menit sejak tengah malam menurut jam dinding Asia/Jakarta.
 *
 * Ini pengganti langsung `d.getHours() * 60 + d.getMinutes()`, yang hasilnya
 * ikut `TZ` proses.
 *
 * `hourCycle: "h23"` wajib, dan ini diverifikasi bukan diasumsikan: tanpanya
 * `en-CA` memakai siklus 12 jam, sehingga instan 00:30 Jakarta diformat
 * `"12:30 a.m."`. Bagian `hour`-nya bernilai `"12"`, jadi absensi pukul 00:30
 * akan terhitung sebagai menit ke-750 — selisih 12 jam yang tidak melempar
 * error apa pun dan tetap terlihat seperti angka yang wajar.
 *
 * Mengembalikan `NaN` untuk `Date` yang invalid, bukan `0`: menit ke-0 berarti
 * "check-in tepat tengah malam", yaitu telat 8 jam lebih — kesalahan data
 * tidak boleh menyamar jadi pelanggaran peserta. Pemanggil wajib memeriksanya.
 */
export function jakartaMinutesOfDay(instant: Date): number {
  // `formatToParts` MELEMPAR `RangeError` untuk Date invalid (diverifikasi),
  // bukan mengembalikan bagian bernilai "NaN". Tanpa penjagaan ini, satu kolom
  // timestamp yang rusak akan menggagalkan seluruh render halaman absensi atau
  // unduhan CSV, bukan cuma satu baris.
  if (Number.isNaN(instant.getTime())) return Number.NaN;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.NaN;

  return hour * 60 + minute;
}

/**
 * Parse `"HH:MM"` dari `attendance_settings.check_in_time` menjadi menit sejak
 * tengah malam.
 *
 * Nilai itu **jam dinding Jakarta yang disimpan sebagai teks**, bukan instan,
 * jadi tidak perlu konversi zona — cuma perlu divalidasi. Sebelumnya dua titik
 * memanggil `parseInt` tanpa pemeriksaan, sehingga isi kolom yang rusak menjadi
 * `NaN` dan membuat setiap perbandingan telat bernilai false secara senyap,
 * yaitu **tidak ada peserta yang pernah terhitung telat**.
 *
 * Mengembalikan `null` kalau bentuknya tidak valid, supaya pemanggil memilih
 * default secara eksplisit.
 */
export function parseWallClockMinutes(value: unknown): number | null {
  // `typeof`, bukan cuma `!value`: nilainya dibaca dari Supabase dan kedua
  // pemanggil menyalurkannya langsung (`settings?.check_in_time`). Kalau
  // kolomnya pernah bertipe lain — atau baris JSON menyimpan angka — `.trim()`
  // melempar `TypeError` dan yang runtuh bukan satu baris, melainkan **seluruh
  // render halaman absensi** dan **route unduh CSV**. Fungsi ini ada justru untuk
  // menahan data rusak, jadi ia tidak boleh ikut runtuh karenanya.
  if (typeof value !== "string") return null;
  if (!value) return null;

  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return hour * 60 + minute;
}
