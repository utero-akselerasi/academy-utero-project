/**
 * Rentang tanggal izin → daftar tanggal absensi. Dipisah supaya bisa diuji.
 *
 * ## Empat kegagalan senyap di bentuk lama
 *
 * ```
 * const current = new Date(permit.start_date);
 * const end = new Date(newEndDate);
 * while (current <= end) { … current.setDate(current.getDate() + 1); }
 * ```
 *
 * 1. **`end_date` sebelum `start_date` menghasilkan nol iterasi.** Kolomnya
 *    nullable dan tak ada `CHECK` yang mengurutkannya, dan `newEndDate` datang
 *    dari `formData.get("endDate")` **tanpa validasi apa pun**. Admin yang salah
 *    ketik tanggal melihat "izin disetujui" sementara **tidak satu pun baris
 *    absensi terbuat**. Peserta lalu tercatat alpa untuk hari-hari yang izinnya
 *    justru sudah disetujui.
 * 2. **Tanggal null jadi epoch, bukan error.** `new Date(null)` adalah
 *    1970-01-01. Kedua kolom nullable, jadi `start_date` null dengan `end_date`
 *    hari ini menghasilkan **loop puluhan ribu iterasi** yang membangun puluhan
 *    ribu baris `attendances` — lalu mengirimkannya sebagai satu upsert.
 * 3. **Tanggal tak terurai jadi loop tak berujung yang senyap.**
 *    `new Date("bukan tanggal")` adalah `Invalid Date`; `current <= end` bernilai
 *    `false` (perbandingan dengan NaN), jadi hasilnya nol baris — sama tak
 *    terlihatnya dengan kasus 1.
 * 4. **`toISOString()` menggeser tanggal untuk zona waktu timur UTC.** Kolomnya
 *    `date`, jadi Supabase mengembalikan `"YYYY-MM-DD"` dan `new Date()`
 *    mengurainya sebagai tengah malam **UTC** — kebetulan aman. Tapi nilai yang
 *    pernah lewat sebagai timestamp berzona (atau `new Date(y, m, d)` dari kode
 *    lain) akan diurai sebagai waktu lokal, dan `toISOString()` pada tengah malam
 *    WIB menghasilkan tanggal **hari sebelumnya**. Karena itu fungsi ini tidak
 *    memakai `Date` sama sekali: aritmetika tanggal kalender dikerjakan atas
 *    bilangan, jadi zona waktu tidak pernah ikut bermain.
 */

/** Batas atas jumlah hari dalam satu izin. */
const MAKS_HARI = 366;

export type HasilRentang =
  | { ok: true; tanggal: string[] }
  | { ok: false; message: string };

const POLA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Urai `"YYYY-MM-DD"` menjadi angka hari-sejak-epoch, atau `null`.
 *
 * Menolak tanggal yang tidak ada (`2026-02-30`) alih-alih menggulungnya seperti
 * `Date` — `new Date("2026-02-30")` di beberapa jalur menjadi 2 Maret, jadi izin
 * bertanggal salah ketik akan membuat absensi di hari yang tidak diminta.
 */
function keHariEpoch(nilai: unknown): number | null {
  if (typeof nilai !== "string") return null;

  const cocok = POLA.exec(nilai.trim());
  if (!cocok) return null;

  const tahun = Number(cocok[1]);
  const bulan = Number(cocok[2]);
  const hari = Number(cocok[3]);

  if (bulan < 1 || bulan > 12) return null;
  if (hari < 1 || hari > 31) return null;

  const stempel = Date.UTC(tahun, bulan - 1, hari);
  if (!Number.isFinite(stempel)) return null;

  // Penjaga penggulungan: `Date.UTC(2026, 1, 30)` adalah 2 Maret. Kalau hasilnya
  // dirangkai ulang dan tidak sama dengan masukan, tanggalnya tidak ada.
  const kembali = dariHariEpoch(stempel / 86_400_000);
  if (kembali !== `${cocok[1]}-${cocok[2]}-${cocok[3]}`) return null;

  return stempel / 86_400_000;
}

/** Kebalikan `keHariEpoch`. `toISOString()` di sini aman — nilainya UTC murni. */
function dariHariEpoch(hari: number): string {
  return new Date(hari * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Daftar tanggal inklusif dari `mulai` sampai `selesai`.
 *
 * Mengembalikan `{ ok: false }` alih-alih daftar kosong untuk setiap masukan yang
 * tidak sah. Bedanya menentukan: daftar kosong **tak bisa dibedakan** dari izin
 * satu hari yang wajar oleh pemanggil, dan itulah yang membuat cacat lamanya tidak
 * terlihat selama ini.
 */
export function rentangTanggalIzin(mulai: unknown, selesai: unknown): HasilRentang {
  const awal = keHariEpoch(mulai);
  if (awal === null) {
    return { ok: false, message: "Tanggal mulai izin tidak valid." };
  }

  const akhir = keHariEpoch(selesai);
  if (akhir === null) {
    return { ok: false, message: "Tanggal selesai izin tidak valid." };
  }

  if (akhir < awal) {
    return {
      ok: false,
      message: "Tanggal selesai izin tidak boleh lebih awal dari tanggal mulai.",
    };
  }

  const jumlah = akhir - awal + 1;
  if (jumlah > MAKS_HARI) {
    // Batas ini yang mencegah `start_date` null (dulu jadi epoch) membangun
    // puluhan ribu baris absensi dalam satu upsert.
    return {
      ok: false,
      message: `Rentang izin terlalu panjang (maksimal ${MAKS_HARI} hari).`,
    };
  }

  const tanggal: string[] = [];
  for (let h = awal; h <= akhir; h += 1) {
    tanggal.push(dariHariEpoch(h));
  }

  return { ok: true, tanggal };
}
