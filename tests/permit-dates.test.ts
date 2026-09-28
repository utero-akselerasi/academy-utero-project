import { describe, expect, it } from "vitest";
import { rentangTanggalIzin } from "@/features/attendance/permit-dates";

/**
 * Loop tanggal izin di `reviewPermitAction` punya empat kegagalan senyap, dan
 * ketiga yang pertama semuanya bermuara pada hal yang sama: **nol baris absensi
 * terbuat, tanpa satu pun error.** Izin tersimpan "approved", admin melihat
 * halaman berhasil dimuat ulang, dan peserta tercatat **alpa** untuk hari-hari
 * yang izinnya justru sudah disetujui.
 *
 * `newEndDate` berasal dari `formData.get("endDate")` tanpa validasi apa pun, dan
 * kedua kolom `date` di `permits` nullable tanpa `CHECK` yang mengurutkannya.
 *
 * Setiap kasus memakai **asersi ganda**: loop lamanya direkonstruksi dan
 * dibuktikan salah, lalu bentuk sekarang dibuktikan menolak.
 */

/** Rekonstruksi persis loop lamanya, untuk dibuktikan salah. */
function loopLama(mulai: unknown, selesai: unknown): string[] {
  const current = new Date(mulai as string);
  const end = new Date(selesai as string);
  const hasil: string[] = [];
  // Batas keamanan untuk test — loop aslinya tidak punya.
  let jaga = 0;
  while (current <= end && jaga < 100_000) {
    hasil.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
    jaga += 1;
  }
  return hasil;
}

describe("cacat 1 — end_date sebelum start_date menghasilkan nol baris", () => {
  it("loop lama diam-diam menghasilkan daftar kosong", () => {
    // Inilah yang paling mungkin terjadi: admin salah ketik tanggal.
    expect(loopLama("2026-03-10", "2026-03-05")).toEqual([]);

    const hasil = rentangTanggalIzin("2026-03-10", "2026-03-05");
    expect(hasil.ok).toBe(false);
    expect(hasil.ok === false && hasil.message).toMatch(/lebih awal/i);
  });

  it("daftar kosong tak bisa dibedakan dari izin satu hari — itu akar tak-terlihatnya", () => {
    // Pemanggil lama hanya melihat `inserts.length`. Satu hari memberi 1, rentang
    // terbalik memberi 0, dan keduanya berjalan lewat cabang `if` yang sama tanpa
    // keluhan. Karena itu fungsi ini mengembalikan `ok: false`, bukan `[]`.
    const sehari = rentangTanggalIzin("2026-03-05", "2026-03-05");
    expect(sehari).toEqual({ ok: true, tanggal: ["2026-03-05"] });
  });
});

describe("cacat 2 — tanggal null jadi epoch, bukan error", () => {
  it("membuktikan `new Date(null)` adalah 1970-01-01", () => {
    expect(new Date(null as unknown as string).toISOString().slice(0, 10)).toBe("1970-01-01");
  });

  it("loop lama membangun puluhan ribu baris dari start_date null", () => {
    // `start_date` null + `end_date` hari ini = satu upsert berisi puluhan ribu
    // baris `attendances`.
    const panjang = loopLama(null, "2026-03-05").length;
    expect(panjang).toBeGreaterThan(20_000);

    expect(rentangTanggalIzin(null, "2026-03-05").ok).toBe(false);
  });

  it("menolak null, undefined, dan string kosong di kedua sisi", () => {
    for (const nilai of [null, undefined, "", "   "]) {
      expect(rentangTanggalIzin(nilai, "2026-03-05").ok, `mulai=${nilai}`).toBe(false);
      expect(rentangTanggalIzin("2026-03-05", nilai).ok, `selesai=${nilai}`).toBe(false);
    }
  });

  it("menyebut sisi mana yang salah — pesannya harus bisa ditindaklanjuti", () => {
    expect(rentangTanggalIzin(null, "2026-03-05")).toEqual({
      ok: false,
      message: "Tanggal mulai izin tidak valid.",
    });
    expect(rentangTanggalIzin("2026-03-05", "bukan tanggal")).toEqual({
      ok: false,
      message: "Tanggal selesai izin tidak valid.",
    });
  });
});

describe("cacat 3 — tanggal tak terurai jadi nol baris yang senyap", () => {
  it("membuktikan Invalid Date membuat perbandingan selalu false", () => {
    const rusak = new Date("bukan tanggal");
    expect(Number.isNaN(rusak.getTime())).toBe(true);
    // `current <= end` dengan NaN adalah `false`, jadi loop tak pernah jalan.
    expect(new Date("2026-03-01") <= rusak).toBe(false);
    expect(loopLama("2026-03-01", "bukan tanggal")).toEqual([]);

    expect(rentangTanggalIzin("2026-03-01", "bukan tanggal").ok).toBe(false);
  });

  it("menolak bentuk selain YYYY-MM-DD", () => {
    for (const nilai of ["05/03/2026", "2026-3-5", "5 Maret 2026", "20260305", "2026-03-05T10:00:00Z"]) {
      expect(rentangTanggalIzin(nilai, "2026-03-31").ok, nilai).toBe(false);
    }
  });

  it("menolak masukan bukan string — `permits.*` bisa mengembalikan apa saja", () => {
    for (const nilai of [0, 1759000000000, {}, [], true]) {
      expect(rentangTanggalIzin(nilai, "2026-03-31").ok, String(nilai)).toBe(false);
    }
  });
});

describe("cacat 4 — tanggal yang tidak ada digulung, bukan ditolak", () => {
  it("menolak 30 Februari alih-alih menggesernya ke Maret", () => {
    // `Date.UTC(2026, 1, 30)` adalah 2 Maret. Izin bertanggal salah ketik akan
    // membuat absensi di hari yang tidak diminta.
    expect(new Date(Date.UTC(2026, 1, 30)).toISOString().slice(0, 10)).toBe("2026-03-02");
    expect(rentangTanggalIzin("2026-02-30", "2026-03-01").ok).toBe(false);
  });

  it("menolak 31 April dan bulan/hari di luar rentang", () => {
    for (const nilai of ["2026-04-31", "2026-13-01", "2026-00-10", "2026-03-32", "2026-03-00"]) {
      expect(rentangTanggalIzin(nilai, "2026-12-01").ok, nilai).toBe(false);
    }
  });

  it("menerima 29 Februari di tahun kabisat, menolak di tahun biasa", () => {
    expect(rentangTanggalIzin("2028-02-29", "2028-02-29").ok).toBe(true);
    expect(rentangTanggalIzin("2026-02-29", "2026-03-01").ok).toBe(false);
  });
});

describe("batas panjang rentang", () => {
  it("menolak rentang di atas 366 hari", () => {
    const hasil = rentangTanggalIzin("2026-01-01", "2027-12-31");
    expect(hasil.ok).toBe(false);
    expect(hasil.ok === false && hasil.message).toMatch(/terlalu panjang/i);
  });

  it("menerima tepat 366 hari", () => {
    // 2028 kabisat: 1 Jan s.d. 31 Des = 366 hari.
    const hasil = rentangTanggalIzin("2028-01-01", "2028-12-31");
    expect(hasil.ok && hasil.tanggal.length).toBe(366);
  });
});

describe("rentang yang benar", () => {
  it("inklusif di kedua ujung", () => {
    expect(rentangTanggalIzin("2026-03-05", "2026-03-08")).toEqual({
      ok: true,
      tanggal: ["2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08"],
    });
  });

  it("melintasi batas bulan", () => {
    const hasil = rentangTanggalIzin("2026-02-27", "2026-03-02");
    expect(hasil.ok && hasil.tanggal).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });

  it("melintasi batas tahun", () => {
    const hasil = rentangTanggalIzin("2026-12-30", "2027-01-02");
    expect(hasil.ok && hasil.tanggal).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  it("29 Februari ikut terhitung di tahun kabisat", () => {
    const hasil = rentangTanggalIzin("2028-02-28", "2028-03-01");
    expect(hasil.ok && hasil.tanggal).toEqual(["2028-02-28", "2028-02-29", "2028-03-01"]);
  });

  it("memangkas spasi di ujung", () => {
    expect(rentangTanggalIzin(" 2026-03-05 ", " 2026-03-05 ").ok).toBe(true);
  });

  it("hasilnya berbentuk YYYY-MM-DD tanpa pergeseran zona waktu", () => {
    // Kolomnya `date`; tanggal yang bergeser satu hari akan mencatat absensi di
    // hari yang salah, dan pergeseran itu tak terlihat sampai ada yang
    // membandingkannya dengan izin aslinya.
    const hasil = rentangTanggalIzin("2026-03-05", "2026-03-07");
    expect(hasil.ok && hasil.tanggal[0]).toBe("2026-03-05");
    expect(hasil.ok && hasil.tanggal.every((t) => /^\d{4}-\d{2}-\d{2}$/.test(t))).toBe(true);
  });

  it("tidak ada tanggal ganda", () => {
    const hasil = rentangTanggalIzin("2026-03-01", "2026-03-31");
    // Penting karena `upsert` memakai `onConflict: "intern_id, attendance_date"`:
    // tanggal ganda dalam SATU batch membuat Postgres menolak seluruh perintah
    // dengan "cannot affect row a second time", jadi nol absensi terbuat.
    expect(hasil.ok && new Set(hasil.tanggal).size).toBe(31);
  });
});
