import { describe, expect, it } from "vitest";
import {
  APP_TIME_ZONE,
  jakartaDateString,
  jakartaMinutesOfDay,
  parseWallClockMinutes,
} from "@/lib/time";

/**
 * Kenapa modul ini yang dites:
 *
 * Ketiga fungsi di sini menentukan **apakah peserta terhitung telat**, dan tidak
 * satu pun kesalahannya melempar. Yang keluar adalah angka yang tetap terlihat
 * wajar di laporan — bergeser beberapa jam, atau tak pernah menandai siapa pun
 * telat. Tak ada yang akan menyadarinya sampai ada yang membandingkan dengan jam
 * dinding sebenarnya.
 *
 * `lib/time.ts:57` sendiri mencatat bug 12 jam `hourCycle` dan menyebutnya
 * "diverifikasi bukan diasumsikan" — tapi verifikasinya tidak pernah ditulis jadi
 * test. Berkas ini yang menjadikannya asersi. Kalau `hourCycle: "h23"` dihapus,
 * test di bawah **gagal**.
 *
 * Semua instan ditulis sebagai UTC eksplisit (`Z`), bukan `new Date(y, m, d, …)`,
 * supaya hasilnya tidak ikut `TZ` mesin yang menjalankan test. Itu justru premis
 * yang sedang diuji.
 */

/** Jakarta = UTC+7 tanpa DST. Jadi 00:30 WIB adalah 17:30 UTC hari sebelumnya. */
const WIB_0030 = new Date("2026-03-04T17:30:00Z");
const WIB_0800 = new Date("2026-03-05T01:00:00Z");
const WIB_1230 = new Date("2026-03-05T05:30:00Z");
const WIB_2359 = new Date("2026-03-05T16:59:00Z");

describe("zona waktunya disebut eksplisit, tidak diwarisi dari TZ", () => {
  it("konstanta zonanya Asia/Jakarta", () => {
    expect(APP_TIME_ZONE).toBe("Asia/Jakarta");
  });

  it("hasilnya sama tanpa peduli TZ proses — itu seluruh alasan modul ini ada", () => {
    // Bentuk lamanya `d.getHours() * 60 + d.getMinutes()`, yang ikut TZ proses.
    // Di mesin ber-TZ=UTC, instan ini memberi 60 menit; di Jakarta memberi 480.
    // Selisih 7 jam yang tidak melempar apa pun.
    const lama = WIB_0800.getUTCHours() * 60 + WIB_0800.getUTCMinutes();
    expect(lama).toBe(60);

    expect(jakartaMinutesOfDay(WIB_0800)).toBe(480);
  });
});

describe("bug 12 jam hourCycle — yang didokumentasikan tapi belum pernah diuji", () => {
  it("00:30 WIB adalah menit ke-30, BUKAN ke-750", () => {
    // Tanpa `hourCycle: "h23"`, `en-CA` memakai siklus 12 jam: 00:30 diformat
    // "12:30 a.m." dan bagian `hour`-nya bernilai "12", jadi hasilnya 750.
    // Selisih 12 jam ini akan menandai check-in tengah malam sebagai telat.
    expect(jakartaMinutesOfDay(WIB_0030)).toBe(30);
  });

  it("membuktikan siklus 12 jam memang menghasilkan 750 — asersi yang mengunci h23", () => {
    // Ini rekonstruksi bentuk tanpa `hourCycle`. Kalau `h23` dihapus dari
    // implementasinya, kedua nilai jadi sama dan asersi terakhir gagal.
    const tanpaH23 = new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(WIB_0030);
    const jam = Number(tanpaH23.find((p) => p.type === "hour")?.value);
    const menit = Number(tanpaH23.find((p) => p.type === "minute")?.value);
    expect(jam * 60 + menit).toBe(750);

    expect(jakartaMinutesOfDay(WIB_0030)).not.toBe(750);
  });

  it("12:30 WIB adalah menit ke-750 — siang hari harus tetap benar", () => {
    // Sisi kebalikannya: siklus 12 jam kebetulan benar untuk 12:30, jadi test
    // tengah malam saja tidak cukup untuk membedakan kedua bentuk.
    expect(jakartaMinutesOfDay(WIB_1230)).toBe(750);
  });

  it("tengah malam tepat adalah 0, dan 23:59 adalah 1439", () => {
    expect(jakartaMinutesOfDay(new Date("2026-03-04T17:00:00Z"))).toBe(0);
    expect(jakartaMinutesOfDay(WIB_2359)).toBe(1439);
  });
});

describe("Date invalid — NaN, bukan 0, dan tidak melempar", () => {
  it("mengembalikan NaN, bukan 0 — menit ke-0 berarti telat 8 jam", () => {
    // Kalau ia mengembalikan 0, satu kolom timestamp rusak akan tampil sebagai
    // "check-in tepat tengah malam" = pelanggaran berat peserta. Kesalahan data
    // tidak boleh menyamar jadi pelanggaran orang.
    const hasil = jakartaMinutesOfDay(new Date("bukan tanggal"));
    expect(Number.isNaN(hasil)).toBe(true);
    expect(hasil).not.toBe(0);
  });

  it("tidak melempar — `formatToParts` MELEMPAR RangeError tanpa penjagaan ini", () => {
    // Inilah yang dijaga `lib/time.ts:72`. Tanpanya, satu baris rusak
    // menggagalkan seluruh render halaman absensi atau unduhan CSV.
    expect(() =>
      new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, hour: "2-digit" }).formatToParts(
        new Date("bukan tanggal"),
      ),
    ).toThrow(RangeError);

    expect(() => jakartaMinutesOfDay(new Date("bukan tanggal"))).not.toThrow();
  });

  it("NaN yang keluar WAJIB diperiksa pemanggil — `NaN > batas` selalu false", () => {
    // Pola yang sama seperti di geofence: pemanggil yang membandingkan
    // `menit > batasTelat` tanpa memeriksa keterhinggaan akan menganggap SETIAP
    // baris rusak sebagai tidak telat.
    const nan = jakartaMinutesOfDay(new Date(NaN));
    expect(nan > 480).toBe(false);
    expect(nan < 480).toBe(false);
    expect(Number.isFinite(nan)).toBe(false);
  });
});

describe("jakartaDateString", () => {
  it("berbentuk YYYY-MM-DD, bisa dibandingkan langsung dengan kolom `date`", () => {
    expect(jakartaDateString(WIB_0800)).toBe("2026-03-05");
    expect(jakartaDateString(WIB_0800)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("instan sebelum tengah malam UTC tetap tanggal Jakarta yang benar", () => {
    // 17:30 UTC tanggal 4 adalah 00:30 WIB tanggal 5. Ini kasus yang membuat
    // `toISOString().slice(0, 10)` salah sehari — dan salah sehari pada absensi
    // berarti peserta tercatat alpa.
    expect(WIB_0030.toISOString().slice(0, 10)).toBe("2026-03-04");
    expect(jakartaDateString(WIB_0030)).toBe("2026-03-05");
  });

  it("instan setelah tengah malam UTC tapi sebelum 07:00 masih tanggal UTC yang sama", () => {
    // 02:00 UTC tanggal 5 = 09:00 WIB tanggal 5. Keduanya setuju di sini, jadi
    // test sebelumnya yang membedakan kedua bentuk.
    expect(jakartaDateString(new Date("2026-03-05T02:00:00Z"))).toBe("2026-03-05");
  });

  it("melintasi batas tahun dengan benar", () => {
    // 31 Des 2025 18:00 UTC = 1 Jan 2026 01:00 WIB.
    expect(jakartaDateString(new Date("2025-12-31T18:00:00Z"))).toBe("2026-01-01");
  });

  it("nol di depan dipertahankan — `en-CA` dipilih justru karena ini", () => {
    // Locale lain memberi "2026-3-5", yang tidak cocok dengan kolom `date` saat
    // dibandingkan sebagai string.
    expect(jakartaDateString(new Date("2026-01-09T05:00:00Z"))).toBe("2026-01-09");
  });

  it("29 Februari tahun kabisat", () => {
    expect(jakartaDateString(new Date("2028-02-29T05:00:00Z"))).toBe("2028-02-29");
  });

  it("hasilnya bisa diurutkan sebagai string — premis kueri rentang tanggal", () => {
    const a = jakartaDateString(new Date("2026-03-05T05:00:00Z"));
    const b = jakartaDateString(new Date("2026-03-10T05:00:00Z"));
    const c = jakartaDateString(new Date("2026-11-01T05:00:00Z"));
    expect([c, a, b].sort()).toEqual([a, b, c]);
  });
});

describe("parseWallClockMinutes — kolom teks, bukan instan", () => {
  it("membuktikan `parseInt` tanpa pemeriksaan membuat NOL peserta terhitung telat", () => {
    // Bentuk lamanya `parseInt(value)` di dua titik. Isi kolom rusak jadi `NaN`,
    // dan `menitCheckIn > NaN` adalah `false` — jadi tak satu pun peserta pernah
    // terhitung telat, tanpa satu pun error.
    const lama = parseInt("jam delapan", 10);
    expect(Number.isNaN(lama)).toBe(true);
    expect(480 > lama).toBe(false);

    expect(parseWallClockMinutes("jam delapan")).toBeNull();
  });

  it("membuktikan `parseInt(\"08:00\")` menelan menitnya", () => {
    // Lebih halus dari NaN: `parseInt("08:30")` adalah 8, bukan 510. Jadi batas
    // telat 08:30 dibaca sebagai menit ke-8, dan hampir semua orang telat.
    expect(parseInt("08:30", 10)).toBe(8);
    expect(parseWallClockMinutes("08:30")).toBe(510);
  });

  it("mengurai bentuk yang sah", () => {
    expect(parseWallClockMinutes("00:00")).toBe(0);
    expect(parseWallClockMinutes("08:00")).toBe(480);
    expect(parseWallClockMinutes("8:00")).toBe(480);
    expect(parseWallClockMinutes("23:59")).toBe(1439);
    expect(parseWallClockMinutes(" 08:30 ")).toBe(510);
  });

  it("mengembalikan null untuk kolom kosong, bukan 0", () => {
    // 0 berarti "batas telat tengah malam" = semua orang telat. Null memaksa
    // pemanggil memilih default secara eksplisit.
    for (const nilai of [null, undefined, "", "   "]) {
      expect(parseWallClockMinutes(nilai), JSON.stringify(nilai)).toBeNull();
    }
  });

  it("menolak jam dan menit di luar rentang", () => {
    for (const nilai of ["24:00", "25:30", "08:60", "99:99"]) {
      expect(parseWallClockMinutes(nilai), nilai).toBeNull();
    }
  });

  it("menolak bentuk yang bukan HH:MM", () => {
    for (const nilai of [
      "08:00:00", // dengan detik — bentuk `time` Postgres
      "0800",
      "8",
      "08.00",
      "08:0",
      "08:000",
      "8 pagi",
      "08:00 WIB",
      "-08:00",
      "+08:00",
    ]) {
      expect(parseWallClockMinutes(nilai), nilai).toBeNull();
    }
  });

  it("menolak masukan bukan string TANPA MELEMPAR — cacat yang ketemu lewat test ini", () => {
    // Bentuk sebelumnya cuma `if (!value) return null`, lalu `value.trim()`.
    // Untuk nilai non-string yang truthy itu melempar `TypeError`, dan karena
    // kedua pemanggil (`app/dashboard/mentor/attendance/page.tsx:123` dan
    // `.../export/route.ts:156`) menyalurkan `settings?.check_in_time` langsung
    // dari Supabase, yang runtuh adalah SELURUH halaman absensi dan route unduh
    // CSV — bukan satu baris. Fungsi ini ada untuk menahan data rusak, jadi ia
    // tidak boleh ikut runtuh karenanya.
    expect(() => "x".trim()).not.toThrow();
    expect(() => (480 as unknown as string).trim()).toThrow(TypeError);

    for (const nilai of [480, {}, [], true, new Date()]) {
      expect(() => parseWallClockMinutes(nilai)).not.toThrow();
      expect(parseWallClockMinutes(nilai), String(nilai)).toBeNull();
    }
  });

  it("hasilnya seukuran dengan `jakartaMinutesOfDay` — keduanya menit sejak tengah malam", () => {
    // Asersi yang mengikat kedua fungsi: keduanya dibandingkan langsung di
    // perhitungan telat, jadi satuannya harus sama.
    expect(parseWallClockMinutes("08:00")).toBe(jakartaMinutesOfDay(WIB_0800));
  });
});
