import { describe, expect, it } from "vitest";
import { buildStoragePath } from "@/lib/uploads";

/**
 * `buildStoragePath` adalah **satu-satunya penghasil object path** di seluruh
 * aplikasi — ke-16 titik unggah memanggilnya. Itu yang membuatnya tempat yang
 * benar untuk menolak traversal, dan itu juga yang membuat cacat di sini kena ke
 * semua titik sekaligus.
 *
 * Bentuk lamanya:
 *
 * ```ts
 * const cleanPrefix = prefix.replace(/^\/+|\/+$/g, "");
 * ```
 *
 * Itu hanya membuang slash di **ujung**. `../` di tengah lolos utuh. Empat
 * pemanggil menurunkan `prefix` dari ID: `lessons/${lessonId}`,
 * `assignment/${assignmentId}/${internProfileId}`, `cardId`, `finalReportId` —
 * dan bucket `avatars` adalah keranjang campur berisi CV, selfie, dan surat
 * sakit, jadi berpindah prefix di dalamnya berarti melintasi batas kerahasiaan.
 *
 * Kenapa melempar, bukan membersihkan: kalau segmen dibuang tanpa suara,
 * pemanggil menyimpan path yang berbeda dari yang benar-benar dipakai dan
 * objeknya jadi tak terjangkau — kegagalan senyap, yang persis jenis cacat yang
 * paling lama tidak ketahuan di repo ini.
 */

const UUID_DOT_EXT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;

describe("buildStoragePath — bentuk keluaran", () => {
  it("menaruh UUID sebagai nama berkas, bukan nama dari klien", () => {
    const hasil = buildStoragePath("uid/attendance_in", "jpg");
    expect(hasil.startsWith("uid/attendance_in/")).toBe(true);
    expect(hasil.slice("uid/attendance_in/".length)).toMatch(UUID_DOT_EXT);
  });

  it("dua pemanggilan berurutan tidak bertabrakan", () => {
    // Inilah alasan UUID dipakai alih-alih Date.now(), dan alasan pemanggil tidak
    // perlu `upsert: true`.
    expect(buildStoragePath("x", "jpg")).not.toBe(buildStoragePath("x", "jpg"));
  });

  it("prefix kosong menghasilkan nama berkas saja, tanpa slash depan", () => {
    // `//nama.jpg` adalah path yang berbeda dari `nama.jpg` di Supabase.
    expect(buildStoragePath("", "jpg")).toMatch(UUID_DOT_EXT);
    expect(buildStoragePath("/", "jpg")).toMatch(UUID_DOT_EXT);
  });

  it("menormalkan slash berlebih tanpa menolak", () => {
    // Slash di ujung dan yang dobel adalah kelalaian penulisan, bukan serangan.
    expect(buildStoragePath("/uid/foto/", "jpg").startsWith("uid/foto/")).toBe(true);
    expect(buildStoragePath("uid//foto", "jpg").startsWith("uid/foto/")).toBe(true);
  });

  it("menerima bentuk prefix yang benar-benar dipakai ke-16 titik unggah", () => {
    for (const prefix of [
      "lessons/8f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f",
      "assignment/8f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f/9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
      "8f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f",
      "cv",
      "portfolio",
      "settings",
      "8f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f/attendance_in",
    ]) {
      expect(() => buildStoragePath(prefix, "pdf"), prefix).not.toThrow();
    }
  });
});

describe("buildStoragePath — traversal ditolak", () => {
  /**
   * Setiap kasus ditulis dengan asersi ganda: pemangkasan lama meloloskannya, dan
   * versi sekarang melempar. Jadi kalau seseorang kembali ke `replace()`, test
   * ini yang gagal.
   */
  const PANGKAS_LAMA = (s: string) => s.replace(/^\/+|\/+$/g, "");

  const TRAVERSAL = [
    "lessons/../avatars/settings",
    "lessons/../../etc",
    "..",
    "../",
    "uid/../../cv",
    ".",
    "./uid",
  ];

  it.each(TRAVERSAL)("melempar untuk %s", (prefix) => {
    // Bukti bahwa pemangkasan lama tidak menghilangkan `..` — ia masih ada di
    // hasilnya, jadi path akhirnya benar-benar berpindah prefix.
    expect(PANGKAS_LAMA(prefix)).toContain(".");
    expect(() => buildStoragePath(prefix, "jpg")).toThrow();
  });

  it("melempar untuk backslash — Supabase dan alat lain menafsirkannya beda", () => {
    expect(() => buildStoragePath("uid\\..\\cv", "jpg")).toThrow();
    expect(() => buildStoragePath("lessons\\x", "jpg")).toThrow();
  });

  it("melempar untuk karakter kendali, termasuk NUL dan newline", () => {
    // Bisa memotong path di lapisan yang tidak menyangkanya.
    expect(() => buildStoragePath("uid\u0000/cv", "jpg")).toThrow();
    expect(() => buildStoragePath("uid\n/cv", "jpg")).toThrow();
    expect(() => buildStoragePath("uid\u007f", "jpg")).toThrow();
  });

  it("melempar untuk segmen berspasi di ujung", () => {
    // `uid ` dan `uid` adalah dua prefix berbeda di storage, dan bedanya tidak
    // terlihat di log maupun di UI.
    expect(() => buildStoragePath("uid /cv", "jpg")).toThrow();
    expect(() => buildStoragePath(" uid", "jpg")).toThrow();
  });

  it("melempar untuk prefix bukan string", () => {
    // `formData.get()` bisa mengembalikan `File` atau `null`.
    expect(() => buildStoragePath(null as unknown as string, "jpg")).toThrow();
    expect(() => buildStoragePath(undefined as unknown as string, "jpg")).toThrow();
  });
});

describe("buildStoragePath — ekstensi", () => {
  it("menerima ekstensi yang dihasilkan detectFileType", () => {
    // Daftar ini mencerminkan `lib/uploads.ts`; `ext` di sana selalu berasal dari
    // deteksi isi berkas, bukan dari nama yang dikirim klien.
    for (const ext of ["jpg", "jpeg", "png", "gif", "webp", "pdf", "docx", "xlsx", "mp4"]) {
      expect(() => buildStoragePath("uid", ext), ext).not.toThrow();
    }
  });

  it("melempar untuk ekstensi yang memuat titik, slash, atau kosong", () => {
    // Penjaga untuk pemanggil BARU yang menyusupkan ekstensi dari klien; jalur
    // yang ada sekarang tidak bisa sampai ke sini.
    for (const ext of ["", ".jpg", "jpg.exe", "../jpg", "jpg/x", "JPG", "jp g"]) {
      expect(() => buildStoragePath("uid", ext), ext).toThrow();
    }
  });
});
