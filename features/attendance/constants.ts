/**
 * Baris tunggal `attendance_settings` yang menjadi pengaturan absensi global.
 *
 * UUID ini sebelumnya ditulis ulang sebagai literal di **tujuh** tempat, yang
 * membuat satu salah ketik bisa menghasilkan `maybeSingle()` bernilai null —
 * dan null di jalur itu tidak melempar error, ia hanya berarti "pakai default".
 * Jadi salah ketiknya akan muncul sebagai geofence yang mati atau jam kerja yang
 * berubah, bukan sebagai kegagalan.
 *
 * Di `features/attendance/` (bukan `lib/`) karena ini fakta domain absensi,
 * meski beberapa pemanggilnya berada di luar folder ini.
 */
export const ATTENDANCE_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";
