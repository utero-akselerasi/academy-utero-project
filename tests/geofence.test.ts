import { describe, expect, it } from "vitest";
import {
  GEOFENCE_MISCONFIGURED_MESSAGE,
  getDistanceMeters,
  resolveGeofence,
} from "@/features/attendance/geofence";

/**
 * Kenapa fungsi ini yang dites:
 *
 * Geofence menentukan apakah absensi peserta diterima, dan **tidak satu pun
 * kegagalannya melempar error**. Konfigurasi yang salah tidak muncul di log dan
 * tidak muncul di UI — gejalanya cuma "semua peserta di luar radius" atau
 * "geofence tidak berlaku", dan keduanya bisa bertahan berbulan-bulan.
 *
 * Bentuk lamanya adalah dua salinan logika yang sama di `checkIn` dan `checkOut`
 * dengan fallback `||` ke koordinat Malang yang di-hardcode. Test di bawah memakai
 * **asersi ganda** untuk setiap cacat lama: bentuk lama dibuktikan salah, bentuk
 * sekarang benar.
 */

const KANTOR = { lat: -7.9671, lon: 112.6375 };

/**
 * Meneruskan nilai lewat batas tipe `number | null`.
 *
 * Bentuk lama yang dibuktikan di bawah bekerja atas **kolom nullable dari DB**,
 * bukan atas literal. Ditulis sebagai literal, tsc melipatnya jadi konstanta lalu
 * melaporkan `TS2873`/`TS2869` — benar untuk literalnya, tapi bukan yang sedang
 * diuji.
 */
function kolomNullable(nilai: number | null): number | null {
  return nilai;
}

const AKTIF = {
  office_latitude: KANTOR.lat,
  office_longitude: KANTOR.lon,
  allow_geofencing: true,
  radius_meters: 100,
};

describe("cacat 1 — fallback koordinat yang di-hardcode", () => {
  it("koordinat null jadi misconfigured, bukan berpindah ke Malang", () => {
    // Bentuk lama: `settings.office_latitude || -7.9671`. Kolom null tidak
    // mematikan geofence — ia memindahkannya ke kota yang mungkin bukan kantor,
    // lalu SETIAP peserta dinilai di luar radius dan dipaksa unggah bukti.
    const lama = kolomNullable(null) || -7.9671;
    expect(lama).toBe(-7.9671);

    const hasil = resolveGeofence({ ...AKTIF, office_latitude: null });
    expect(hasil.kind).toBe("misconfigured");
  });

  it("longitude null juga misconfigured", () => {
    expect(resolveGeofence({ ...AKTIF, office_longitude: null }).kind).toBe("misconfigured");
  });

  it("menolak, bukan melewati pemeriksaan — keputusan yang disengaja", () => {
    // Melewatinya berarti geofence mati tanpa ada yang tahu. Pesannya menyebut
    // penyebabnya supaya admin memperbaikinya dalam hitungan menit.
    expect(GEOFENCE_MISCONFIGURED_MESSAGE).toMatch(/koordinat kantor belum diatur/i);
  });
});

describe("cacat 2 — radius 0 diam-diam jadi 100", () => {
  it("membuktikan `|| 100` menelan radius 0", () => {
    // Admin yang menyetel radius 0 (harus tepat di titik kantor) dulu mendapat
    // 100 meter tanpa diberi tahu.
    expect(kolomNullable(0) || 100).toBe(100);
    expect(kolomNullable(0) ?? 100).toBe(0);

    const hasil = resolveGeofence({ ...AKTIF, radius_meters: 0 });
    expect(hasil).toEqual({ kind: "active", latitude: KANTOR.lat, longitude: KANTOR.lon, radiusMeters: 0 });
  });

  it("null tetap memicu default 100", () => {
    const hasil = resolveGeofence({ ...AKTIF, radius_meters: null });
    expect(hasil.kind === "active" && hasil.radiusMeters).toBe(100);
  });

  it("radius negatif misconfigured — tak ada titik yang bisa memenuhinya", () => {
    expect(resolveGeofence({ ...AKTIF, radius_meters: -1 }).kind).toBe("misconfigured");
  });
});

describe("cacat 3 — baris hilang tak dibedakan dari geofence mati", () => {
  it("null dan undefined jadi disabled, tidak melempar", () => {
    expect(resolveGeofence(null)).toEqual({ kind: "disabled" });
    expect(resolveGeofence(undefined)).toEqual({ kind: "disabled" });
  });

  it("allow_geofencing false/null jadi disabled", () => {
    expect(resolveGeofence({ ...AKTIF, allow_geofencing: false }).kind).toBe("disabled");
    expect(resolveGeofence({ ...AKTIF, allow_geofencing: null }).kind).toBe("disabled");
  });

  it("geofence mati tidak peduli koordinatnya rusak — tak ada yang perlu diperiksa", () => {
    expect(
      resolveGeofence({
        office_latitude: null,
        office_longitude: null,
        allow_geofencing: false,
        radius_meters: null,
      }).kind,
    ).toBe("disabled");
  });
});

describe("NaN di koordinat — kenapa cek null saja tidak cukup", () => {
  it("membuktikan NaN membuat SEMUA orang terhitung di dalam radius", () => {
    // Inilah akar bahayanya: pemanggil membandingkan `distance > radiusMeters`,
    // dan `NaN > apa pun` adalah `false` — jadi jarak NaN tidak pernah dianggap
    // di luar jangkauan. Geofence mati total tanpa satu pun tanda.
    const jarak = getDistanceMeters(Number.NaN, 0, KANTOR.lat, KANTOR.lon);
    expect(Number.isNaN(jarak)).toBe(true);
    expect(jarak > 100).toBe(false);

    // `!== null` meloloskan NaN; `Number.isFinite` tidak.
    expect(Number.NaN !== null).toBe(true);
    expect(Number.isFinite(Number.NaN)).toBe(false);

    expect(resolveGeofence({ ...AKTIF, office_latitude: Number.NaN }).kind).toBe("misconfigured");
  });

  it("Infinity di koordinat dan radius juga misconfigured", () => {
    expect(resolveGeofence({ ...AKTIF, office_longitude: Infinity }).kind).toBe("misconfigured");
    expect(resolveGeofence({ ...AKTIF, radius_meters: Infinity }).kind).toBe("misconfigured");
    expect(resolveGeofence({ ...AKTIF, radius_meters: Number.NaN }).kind).toBe("misconfigured");
  });
});

describe("rentang koordinat", () => {
  it("menolak lintang/bujur di luar rentang", () => {
    // Baris produksi bisa menyimpan nilai ini dari sebelum `schemas.ts` ada, dan
    // haversine atas lintang 200° mengembalikan angka tanpa melempar apa pun.
    expect(resolveGeofence({ ...AKTIF, office_latitude: 91 }).kind).toBe("misconfigured");
    expect(resolveGeofence({ ...AKTIF, office_latitude: -90.1 }).kind).toBe("misconfigured");
    expect(resolveGeofence({ ...AKTIF, office_longitude: 181 }).kind).toBe("misconfigured");
    expect(resolveGeofence({ ...AKTIF, office_longitude: -180.5 }).kind).toBe("misconfigured");
  });

  it("menerima batas persis", () => {
    for (const [lat, lon] of [[90, 180], [-90, -180], [0, 0]]) {
      expect(
        resolveGeofence({ ...AKTIF, office_latitude: lat, office_longitude: lon }).kind,
        `${lat},${lon}`,
      ).toBe("active");
    }
  });

  it("titik nol,nol tidak dianggap kosong — `||` dulu menganggapnya begitu", () => {
    // `0 || -7.9671` adalah -7.9671. Kantor di Null Island memang mustahil, tapi
    // cacatnya sama untuk lintang 0 di mana pun di garis khatulistiwa.
    expect(kolomNullable(0) || -7.9671).toBe(-7.9671);
    const hasil = resolveGeofence({ ...AKTIF, office_latitude: 0 });
    expect(hasil.kind === "active" && hasil.latitude).toBe(0);
  });
});

describe("getDistanceMeters — haversine", () => {
  it("jarak ke titik yang sama adalah nol", () => {
    expect(getDistanceMeters(KANTOR.lat, KANTOR.lon, KANTOR.lat, KANTOR.lon)).toBe(0);
  });

  it("satu derajat lintang kira-kira 111 km", () => {
    const jarak = getDistanceMeters(0, 0, 1, 0);
    expect(jarak).toBeGreaterThan(111_000);
    expect(jarak).toBeLessThan(111_400);
  });

  it("simetris — urutan argumen tidak mengubah hasil", () => {
    const a = getDistanceMeters(-7.9671, 112.6375, -6.2088, 106.8456);
    const b = getDistanceMeters(-6.2088, 106.8456, -7.9671, 112.6375);
    expect(a).toBeCloseTo(b, 6);
  });

  it("Malang–Jakarta kira-kira 660 km", () => {
    // Angka acuan dari luar: memastikan rumusnya benar, bukan cuma konsisten
    // dengan dirinya sendiri.
    const jarak = getDistanceMeters(-7.9671, 112.6375, -6.2088, 106.8456);
    expect(jarak / 1000).toBeGreaterThan(640);
    expect(jarak / 1000).toBeLessThan(680);
  });

  it("menangani antipoda tanpa NaN — `Math.sqrt(1 - a)` bisa menyentuh nol", () => {
    // `a` mendekati 1 di titik berlawanan; `1 - a` bisa jadi -1e-16 karena galat
    // pembulatan, dan `Math.sqrt` atas negatif adalah NaN. `atan2` menahannya.
    const jarak = getDistanceMeters(0, 0, 0, 180);
    expect(Number.isFinite(jarak)).toBe(true);
    expect(jarak / 1000).toBeGreaterThan(20_000);
  });

  it("selisih beberapa meter terdeteksi — presisinya harus cukup untuk radius 100 m", () => {
    // 0.0001° lintang ≈ 11 m. Kalau rumusnya kehilangan presisi di skala ini,
    // radius 100 meter jadi tak berarti.
    const jarak = getDistanceMeters(KANTOR.lat, KANTOR.lon, KANTOR.lat + 0.0001, KANTOR.lon);
    expect(jarak).toBeGreaterThan(10);
    expect(jarak).toBeLessThan(12);
  });

  it("masukan tak hingga menghasilkan NaN — kontrak yang disengaja", () => {
    // Didokumentasikan sebagai kontrak, jadi diuji. Pemanggil WAJIB memeriksa
    // keterhinggaan; `resolveGeofence` menjaga sisi pengaturan dan skema Zod
    // menjaga sisi koordinat peserta.
    for (const n of [Number.NaN, Infinity, -Infinity]) {
      expect(Number.isNaN(getDistanceMeters(n, 0, 0, 0)), String(n)).toBe(true);
    }
  });
});

describe("bentuk aktif", () => {
  it("meneruskan nilai apa adanya tanpa default tersembunyi", () => {
    expect(resolveGeofence(AKTIF)).toEqual({
      kind: "active",
      latitude: KANTOR.lat,
      longitude: KANTOR.lon,
      radiusMeters: 100,
    });
  });
});
