import { z } from "zod";

export const checkInSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  wifiSsid: z.string().optional(),
});

export const checkOutSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  wifiSsid: z.string().optional(),
});

/**
 * Pengaturan absensi global — jam kerja + geofence.
 *
 * Sebelumnya `saveAttendanceSettingsAction` tidak memvalidasi apa pun: nilainya
 * dibaca dari FormData lalu masuk `parseFloat`/`parseInt` langsung. Akibatnya,
 * isian yang tidak berbentuk angka jadi `NaN` dan **tersimpan** — dan geofence
 * yang koordinatnya NaN melewatkan setiap pemeriksaan jarak sebagai "di dalam
 * radius", yaitu geofence mati tanpa satu pun pesan error.
 *
 * `z.number()` di zod 4 sudah menolak `NaN` dan `Infinity` (diverifikasi), jadi
 * batas di bawah hanya perlu mengurus rentang yang bermakna secara geografis.
 */
export const attendanceSettingsSchema = z.object({
  checkInTime: z.string().regex(/^\d{1,2}:\d{2}$/, "Jam masuk harus berbentuk HH:MM."),
  checkOutTime: z.string().regex(/^\d{1,2}:\d{2}$/, "Jam pulang harus berbentuk HH:MM."),
  lateToleranceMinutes: z.number().int().min(0, "Toleransi telat tidak boleh negatif.").max(24 * 60),
  monthlyTargetHours: z.number().int().min(0).max(24 * 31, "Target jam bulanan melebihi jumlah jam dalam sebulan."),
  allowGeofencing: z.boolean(),
  // Nullable: geofence yang dimatikan tidak butuh koordinat, dan memaksa admin
  // mengisi angka yang tidak dipakai justru mendorong angka sembarang masuk DB.
  officeLatitude: z.number().min(-90).max(90, "Latitude harus di antara -90 dan 90.").nullable(),
  officeLongitude: z.number().min(-180).max(180, "Longitude harus di antara -180 dan 180.").nullable(),
  // `min(0)`, bukan `min(1)`: radius 0 berarti "harus tepat di titik kantor",
  // dan itu pilihan yang sah. Kode lama memakai `radius_meters || 100` sehingga
  // 0 diam-diam berubah jadi 100 meter.
  radiusMeters: z.number().int().min(0, "Radius tidak boleh negatif.").max(100_000),
}).refine(
  (value) => !value.allowGeofencing || (value.officeLatitude !== null && value.officeLongitude !== null),
  {
    // Inilah yang mencegah keadaan "geofencing aktif tapi koordinat kosong"
    // tersimpan sejak awal. `resolveGeofence` di actions.ts tetap menolak
    // keadaan itu saat absensi, sebagai lapis kedua untuk baris yang sudah ada
    // di DB sebelum validasi ini dipasang.
    message: "Geofencing aktif tapi koordinat kantor belum diisi.",
    path: ["officeLatitude"],
  }
);

export const reviewAttendanceSchema = z.object({
  attendanceId: z.string().uuid("ID absensi tidak valid."),
  status: z.enum(["valid", "invalid", "manual_review"]),
  note: z.string().optional(),
});
