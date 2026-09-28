/**
 * Geofence absensi: bentuk konfigurasi + jarak. Dipisah dari server action supaya
 * bisa diuji.
 *
 * Kenapa dua fungsi ini yang paling butuh test: **keduanya tidak melempar.**
 * `resolveGeofence` mengembalikan bentuk yang salah dan `getDistanceMeters`
 * mengembalikan angka yang salah, dan keduanya langsung menentukan apakah absensi
 * peserta diterima. Kegagalannya tak terlihat di mana pun — tidak di log, tidak di
 * UI. Satu-satunya gejalanya adalah peserta yang tak bisa absen, atau geofence
 * yang diam-diam tidak berlaku.
 */

export type GeofenceSettings = {
  office_latitude: number | null;
  office_longitude: number | null;
  allow_geofencing: boolean | null;
  radius_meters: number | null;
};

export type GeofenceConfig =
  | { kind: "disabled" }
  | { kind: "misconfigured" }
  | { kind: "active"; latitude: number; longitude: number; radiusMeters: number };

/** Radius bawaan kalau kolomnya `null`. Nilai `0` **bukan** null — lihat di bawah. */
const RADIUS_BAWAAN = 100;

/**
 * Satu tempat yang menentukan bentuk geofence, dipakai check-in dan check-out.
 *
 * Sebelumnya logika ini diduplikasi di dua titik dengan tiga masalah:
 *
 * 1. **Koordinat kantor di-hardcode** (`-7.9671`/`112.6375`, Malang) sebagai
 *    fallback `||`. Kalau kolomnya null, geofence tidak mati — ia berpindah ke
 *    kota yang mungkin bukan lokasi kantor, lalu **setiap** peserta dinilai di
 *    luar radius dan dipaksa mengunggah alasan + bukti kegiatan luar. Nilai
 *    default itu tempatnya di migrasi (`0014`), bukan di kode aplikasi.
 * 2. **`radius_meters || 100`** — `0` itu falsy, jadi admin yang menyetel radius
 *    `0` (harus tepat di titik kantor) diam-diam mendapat 100 meter. Diganti
 *    `??`, jadi hanya `null`/`undefined` yang memicu default.
 * 3. Baris yang hilang tidak dibedakan dari geofence yang mati:
 *    `settings?.allow_geofencing` bernilai falsy untuk keduanya.
 *
 * `misconfigured` **menolak absensi**, bukan melewati pemeriksaan. Ini pilihan
 * yang disengaja: melewatinya berarti geofence mati tanpa ada yang tahu, dan
 * keadaan itu bisa bertahan berbulan-bulan. Menolak dengan pesan yang menyebut
 * penyebabnya membuat admin memperbaikinya dalam hitungan menit.
 */
export function resolveGeofence(settings: GeofenceSettings | null | undefined): GeofenceConfig {
  if (!settings?.allow_geofencing) return { kind: "disabled" };

  const latitude = settings.office_latitude;
  const longitude = settings.office_longitude;

  // `Number.isFinite`, bukan cuma cek null: `double precision` Postgres bisa
  // mengembalikan NaN, dan `NaN` lolos setiap perbandingan jarak sebagai false
  // sehingga semua orang terhitung di dalam radius.
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { kind: "misconfigured" };
  }

  // Rentang koordinat ditegakkan di sini juga, bukan hanya di `schemas.ts`.
  // `schemas.ts` menjaga jalur tulis lewat form; baris produksi bisa sudah
  // menyimpan nilai di luar rentang dari sebelum validasi itu ada, dan lintang
  // 200° membuat haversine mengembalikan jarak yang tak berarti tanpa melempar.
  if ((latitude as number) < -90 || (latitude as number) > 90) {
    return { kind: "misconfigured" };
  }
  if ((longitude as number) < -180 || (longitude as number) > 180) {
    return { kind: "misconfigured" };
  }

  const radiusMeters = settings.radius_meters ?? RADIUS_BAWAAN;
  if (!Number.isFinite(radiusMeters) || radiusMeters < 0) {
    return { kind: "misconfigured" };
  }

  return {
    kind: "active",
    latitude: latitude as number,
    longitude: longitude as number,
    radiusMeters,
  };
}

export const GEOFENCE_MISCONFIGURED_MESSAGE =
  "Geofencing aktif tapi koordinat kantor belum diatur. Hubungi admin untuk melengkapi pengaturan absensi.";

/**
 * Jarak haversine dalam meter.
 *
 * Mengembalikan `NaN` kalau ada masukan yang tidak hingga — **disengaja dan
 * penting**. Pemanggilnya membandingkan `distance > radiusMeters`, dan
 * `NaN > apa pun` adalah `false`, jadi masukan rusak akan menghitung peserta
 * sebagai **di dalam** radius. Karena itu pemanggil wajib memeriksa
 * `Number.isFinite(distance)` sebelum membandingkan; `resolveGeofence` menjaga sisi
 * pengaturan, dan `checkInSchema`/`checkOutSchema` menjaga sisi koordinat peserta.
 */
export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // radius bumi dalam meter
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
