import { describe, expect, it } from "vitest";
import { HOST_DRIVE_DIIZINKAN, isAllowedDriveLink } from "@/lib/external-links";

/**
 * Pemeriksaan lamanya adalah pencarian substring:
 *
 * ```ts
 * link.includes("google.com") || link.includes("drive.google.com")
 * ```
 *
 * Nilai yang lolos tersimpan di `daily_report_attachments.file_path` dengan
 * `mime_type: "url"`, lalu dirender sebagai tautan yang **diklik pembimbing**
 * saat mereview laporan. Jadi lubangnya bukan data kotor — ia jalur phishing dari
 * akun peserta ke akun yang haknya lebih tinggi.
 *
 * Setiap kasus bypass di bawah ditulis dengan asersi ganda: `.includes()`
 * memang meloloskannya, dan `isAllowedDriveLink` menolaknya. Bentuk itu dipilih
 * supaya kalau seseorang kembali ke substring, test ini yang gagal, bukan cuma
 * jadi dokumentasi.
 */

describe("isAllowedDriveLink — bypass yang dulu lolos", () => {
  const CEK_LAMA = (s: string) => s.includes("google.com") || s.includes("drive.google.com");

  const BYPASS = [
    // `google.com` cuma awalan hostname; domain sebenarnya `penyerang.net`.
    "http://google.com.penyerang.net/muatan",
    "https://google.com.penyerang.net/muatan",
    // Ada di query string.
    "https://jahat.com/?x=google.com",
    // Ada di fragment.
    "https://jahat.com/#google.com",
    // Ada di path.
    "https://jahat.com/google.com/unduh",
    // Bukan HTTP sama sekali. `new URL()` menerima ini tanpa keluhan.
    "javascript:alert(1)//google.com",
    // Kredensial userinfo: hostname sesungguhnya `penyerang.net`.
    "https://drive.google.com@penyerang.net/x",
    // Subdomain buatan pengguna di bawah google.com — alasan allowlist memakai
    // pencocokan persis, bukan `endsWith(".google.com")`.
    "https://sites.google.com/view/halaman-palsu",
  ];

  it.each(BYPASS)("menolak %s (pemeriksaan lama meloloskannya)", (nilai) => {
    expect(CEK_LAMA(nilai), "kasus ini harus lolos cek lama, kalau tidak ia bukan bukti apa-apa").toBe(true);
    expect(isAllowedDriveLink(nilai)).toBe(false);
  });
});

describe("isAllowedDriveLink — yang memang harus diterima", () => {
  it.each([
    "https://drive.google.com/file/d/1AbC/view",
    "https://drive.google.com/drive/folders/1AbC",
    "https://docs.google.com/document/d/1AbC/edit",
    "https://docs.google.com/spreadsheets/d/1AbC/edit?usp=sharing",
  ])("menerima %s", (nilai) => {
    expect(isAllowedDriveLink(nilai)).toBe(true);
  });

  it("tidak peduli huruf besar-kecil pada hostname", () => {
    // `new URL()` menormalkan hostname jadi huruf kecil, jadi ini gratis — tapi
    // dikunci supaya perubahan ke perbandingan string manual tidak diam-diam
    // membuatnya peka huruf.
    expect(isAllowedDriveLink("https://DRIVE.GOOGLE.COM/file/d/1/view")).toBe(true);
  });

  it("menerima titik akar di ujung hostname", () => {
    // `drive.google.com.` adalah FQDN yang sah dan menuju host yang sama.
    expect(isAllowedDriveLink("https://drive.google.com./file/d/1/view")).toBe(true);
  });

  it("memangkas spasi di ujung — tempel dari clipboard sering membawanya", () => {
    expect(isAllowedDriveLink("  https://drive.google.com/file/d/1/view  ")).toBe(true);
  });
});

describe("isAllowedDriveLink — penolakan lain", () => {
  it("menolak http:, bukan cuma skema berbahaya", () => {
    // Tautannya diklik orang lain, jadi turun ke http berarti bisa disadap.
    expect(isAllowedDriveLink("http://drive.google.com/file/d/1/view")).toBe(false);
  });

  it.each(["data:text/html,<script>alert(1)</script>", "file:///etc/passwd", "ftp://drive.google.com/x"])(
    "menolak skema %s",
    (nilai) => {
      expect(isAllowedDriveLink(nilai)).toBe(false);
    },
  );

  it("menolak host tanpa skema — menambahkan https:// sendiri berarti menebak", () => {
    expect(isAllowedDriveLink("drive.google.com/file/d/1/view")).toBe(false);
  });

  it("menolak kosong, spasi, null, undefined, dan non-string", () => {
    for (const nilai of ["", "   ", null, undefined]) {
      expect(isAllowedDriveLink(nilai)).toBe(false);
    }
    // Nilai dari `formData.get()` bisa `File`, bukan string.
    expect(isAllowedDriveLink(123 as unknown as string)).toBe(false);
  });

  it("menolak drive.usercontent.google.com — sengaja, walau host Google asli", () => {
    // Host itu menyajikan byte mentah dengan tautan berumur pendek; menyimpannya
    // di DB menghasilkan tautan mati, bukan akses.
    expect(isAllowedDriveLink("https://drive.usercontent.google.com/download?id=1")).toBe(false);
  });
});

describe("HOST_DRIVE_DIIZINKAN", () => {
  it("dipakai di pesan galat dan teks bantuan, jadi tidak boleh kosong", () => {
    // `features/daily-reports/actions.ts` dan `DailyReportForm.tsx` keduanya
    // merangkai daftar ini ke teks yang dibaca pengguna.
    expect(HOST_DRIVE_DIIZINKAN).toEqual(["drive.google.com", "docs.google.com"]);
  });

  it("setiap host di daftar benar-benar diterima fungsinya", () => {
    // Menjaga daftar tampilan dan allowlist sesungguhnya tidak menyimpang.
    for (const host of HOST_DRIVE_DIIZINKAN) {
      expect(isAllowedDriveLink(`https://${host}/x`), host).toBe(true);
    }
  });
});
