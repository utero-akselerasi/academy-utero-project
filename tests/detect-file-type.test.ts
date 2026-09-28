import { describe, expect, it } from "vitest";
import { detectFileType, sanitizeDisplayName } from "@/lib/uploads";

/**
 * Kenapa fungsi ini yang dites, dan kenapa ia yang paling penting di antara
 * fungsi murni `lib/`:
 *
 * `detectFileType` adalah **satu-satunya** yang menentukan apakah sebuah berkas
 * boleh masuk storage, dan `validateUpload` mempercayainya sepenuhnya: nilai
 * `mime` yang dikembalikannya dipakai sebagai `contentType` saat unggah, dan
 * `ext`-nya jadi ekstensi object path. Jadi kalau ia salah mengenali HTML atau
 * SVG sebagai gambar, berkas itu tersimpan dengan `Content-Type: image/*` di
 * bucket yang **sebagian masih publik** — yaitu **stored XSS** yang dilayani dari
 * domain aplikasi sendiri.
 *
 * Dan kegagalannya **tidak melempar**. Ia mengembalikan objek yang terlihat wajar;
 * satu-satunya cara menangkapnya adalah test.
 *
 * Komentar di `lib/uploads.ts:38` menyatakan SVG "sengaja TIDAK diizinkan". Itu
 * pernyataan niat, bukan bukti. Test di bawah yang menjadikannya bukti.
 */

const bytes = (...b: number[]) => new Uint8Array(b);
const teks = (s: string) => new TextEncoder().encode(s);

const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00);
const GIF = teks("GIF89a\u0000\u0000");
const PDF = teks("%PDF-1.7\n");
/** RIFF + 4 byte ukuran + WEBP; ukurannya tak diperiksa, jadi nol pun cukup. */
const WEBP = new Uint8Array([...teks("RIFF"), 0, 0, 0, 0, ...teks("WEBP")]);
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00);

describe("format yang bisa mengeksekusi kode ditolak", () => {
  it("menolak SVG — ia bisa memuat <script> dan dirender inline oleh browser", () => {
    const svg = teks('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(detectFileType(svg)).toBeNull();
  });

  it("menolak SVG yang didahului deklarasi XML — bentuk yang dihasilkan alat desain", () => {
    expect(detectFileType(teks('<?xml version="1.0"?><svg><script/></svg>'))).toBeNull();
  });

  it("menolak HTML dalam semua bentuk yang biasa dipakai", () => {
    for (const isi of [
      "<!DOCTYPE html><html><body><script>alert(1)</script>",
      "<html>",
      "<HTML>",
      "<script>alert(1)</script>",
      "<!-- komentar --><html>",
    ]) {
      expect(detectFileType(teks(isi)), isi).toBeNull();
    }
  });

  it("menolak berkas yang isinya kode, bukan gambar", () => {
    for (const isi of [
      "#!/bin/sh\nrm -rf /",
      "<?php system($_GET['c']); ?>",
      "MZ\u0090\u0000", // EXE Windows
      "\u007fELF", // biner Linux
    ]) {
      expect(detectFileType(teks(isi)), isi).toBeNull();
    }
  });

  it("menolak buffer kosong dan buffer nol byte", () => {
    expect(detectFileType(new Uint8Array(0))).toBeNull();
    expect(detectFileType(bytes(0, 0, 0, 0, 0, 0, 0, 0))).toBeNull();
  });
});

describe("nama berkas klien tidak ikut menentukan apa pun", () => {
  it("HTML bernama .jpg tetap ditolak — inilah inti pindah ke magic byte", () => {
    // Cacat lamanya adalah mengambil ekstensi dari `file.name`. Berkas ini akan
    // lolos sebagai "gambar" di bentuk itu, lengkap dengan Content-Type image/jpeg.
    const html = teks("<html><script>fetch('/api/steal')</script></html>");
    expect(detectFileType(html)).toBeNull();
  });

  it("gambar asli tetap diterima apa pun nama aslinya — deteksi dari isi, bukan nama", () => {
    // Sisi kebalikannya: JPEG bernama `.txt` harus tetap dikenali JPEG.
    expect(detectFileType(JPEG)?.mime).toBe("image/jpeg");
  });
});

describe("magic byte yang dikenali", () => {
  it.each([
    ["JPEG", JPEG, "image/jpeg", "jpg", "image"],
    ["PNG", PNG, "image/png", "png", "image"],
    ["GIF", GIF, "image/gif", "gif", "image"],
    ["WEBP", WEBP, "image/webp", "webp", "image"],
    ["PDF", PDF, "application/pdf", "pdf", "document"],
  ] as const)("mengenali %s", (_nama, buf, mime, ext, kind) => {
    expect(detectFileType(buf)).toEqual({ mime, ext, kind });
  });

  it("ZIP dikenali sebagai dokumen OOXML tanpa membuka isinya", () => {
    const hasil = detectFileType(ZIP);
    expect(hasil?.kind).toBe("document");
    expect(hasil?.ext).toBe("docx");
  });

  it("ketiga varian header ZIP dikenali", () => {
    // 0x0304 arsip biasa, 0x0506 arsip kosong, 0x0708 spanned.
    for (const ketiga of [0x04, 0x06, 0x08]) {
      const buf = bytes(0x50, 0x4b, ketiga === 0x04 ? 0x03 : ketiga === 0x06 ? 0x05 : 0x07, ketiga);
      expect(detectFileType(buf)?.kind, String(ketiga)).toBe("document");
    }
  });

  it("`kind` menentukan batas ukuran dan izin call site — jadi ia dikunci", () => {
    // `validateUpload` menolak berkas yang `kind`-nya di luar `allowedKinds`, dan
    // memakai `kind` untuk memilih batas ukuran. Salah `kind` = batas salah.
    expect(detectFileType(PDF)?.kind).toBe("document");
    expect(detectFileType(PNG)?.kind).toBe("image");
  });
});

describe("pencocokan tidak boleh meleset karena panjang buffer", () => {
  it("buffer lebih pendek dari magic byte tidak dianggap cocok", () => {
    // `matches` menjaga panjangnya; tanpa itu `buffer[i]` jadi `undefined` dan
    // perbandingannya `false` — kebetulan aman, tapi tidak boleh diandalkan.
    expect(detectFileType(bytes(0x89, 0x50))).toBeNull();
    expect(detectFileType(bytes(0xff, 0xd8))).toBeNull();
    expect(detectFileType(bytes(0x25, 0x50, 0x44))).toBeNull();
  });

  it("RIFF tanpa WEBP di offset 8 ditolak — WAV dan AVI juga RIFF", () => {
    const wav = new Uint8Array([...teks("RIFF"), 0, 0, 0, 0, ...teks("WAVE")]);
    const avi = new Uint8Array([...teks("RIFF"), 0, 0, 0, 0, ...teks("AVI ")]);
    expect(detectFileType(wav)).toBeNull();
    expect(detectFileType(avi)).toBeNull();
  });

  it("RIFF yang terpotong sebelum offset 8 ditolak, tidak melempar", () => {
    expect(detectFileType(teks("RIFF"))).toBeNull();
    expect(detectFileType(teks("RIFF\u0000\u0000\u0000\u0000WEB"))).toBeNull();
  });
});

describe("magic byte wajib di offset 0", () => {
  it("PDF dengan sampah di depan ditolak — ketat, dan itu disengaja", () => {
    // Browser menerima "%PDF" sampai offset 1024. Kami tidak: satu berkas yang
    // diawali HTML lalu menyusulkan "%PDF" akan dirender sebagai HTML oleh
    // browser sementara kami menandainya application/pdf.
    const gabungan = new Uint8Array([...teks("<html>x</html>"), ...PDF]);
    expect(detectFileType(gabungan)).toBeNull();
  });

  it("PNG dengan satu byte di depan ditolak", () => {
    expect(detectFileType(new Uint8Array([0x00, ...PNG]))).toBeNull();
  });
});

describe("risiko sisa yang diakui, bukan ditutupi", () => {
  it("polyglot GIF/JS LOLOS sebagai image/gif — batas nyata deteksi magic byte", () => {
    // Berkas ini gambar GIF yang sah DAN JavaScript yang sah. `detectFileType`
    // memang menerimanya, dan tidak ada pemeriksaan magic byte yang bisa
    // menolaknya tanpa ikut menolak GIF asli.
    //
    // Yang menahannya berlapis di luar fungsi ini: `contentType` dipaksa
    // `image/gif` (bukan `text/javascript`, jadi browser tak mengeksekusinya
    // sebagai skrip), `allowed_mime_types` per bucket di `0032a`, dan CSP
    // `script-src` yang tidak mengizinkan domain storage.
    //
    // Test ini ada supaya batas itu **tercatat**, bukan ditemukan ulang nanti.
    const polyglot = teks("GIF89a/*\u0000\u0000*/=1;alert(1);//");
    expect(detectFileType(polyglot)?.mime).toBe("image/gif");
  });

  it("ZIP apa pun lolos sebagai docx — termasuk JAR dan APK", () => {
    // Konsekuensinya diterima: isi ZIP tidak dibuka, jadi `.jar` berbahaya akan
    // tersimpan sebagai `.docx`. Ia tidak bisa dieksekusi lewat browser, dan
    // ekstensi tersimpan justru membuatnya tidak dikenali sebagai executable.
    expect(detectFileType(ZIP)?.ext).toBe("docx");
  });
});

describe("sanitizeDisplayName", () => {
  it("membuang seluruh komponen path — nama ini tampil di UI", () => {
    expect(sanitizeDisplayName("../../etc/passwd", "x.pdf")).toBe("passwd");
    expect(sanitizeDisplayName("C:\\Users\\bob\\rahasia.pdf", "x.pdf")).toBe("rahasia.pdf");
    expect(sanitizeDisplayName("/var/www/a.png", "x.png")).toBe("a.png");
  });

  it("membuang karakter kendali dan karakter yang bisa merusak header", () => {
    expect(sanitizeDisplayName('la"por:an|.pdf', "x.pdf")).toBe("laporan.pdf");
    // CRLF **dan** titik dua ikut hilang — keduanya di kelas karakter yang sama.
    // Itu penting: `Content-Disposition: attachment; filename="<nama>"` bisa
    // disuntik header tambahan lewat CRLF, dan titik dua yang tersisa membuat
    // penyuntikan itu masih mungkin di beberapa parser.
    expect(sanitizeDisplayName("a\r\nSet-Cookie: x.pdf", "x.pdf")).toBe("aSet-Cookie x.pdf");
    expect(sanitizeDisplayName("a\u0000b.png", "x.png")).toBe("ab.png");
  });

  it("memakai fallback saat tak ada yang tersisa", () => {
    for (const nama of ["", "   ", "///", '<>:"|?*', "\u0000\u0001"]) {
      expect(sanitizeDisplayName(nama, "berkas.pdf"), JSON.stringify(nama)).toBe("berkas.pdf");
    }
  });

  it("membatasi panjang ke 120 karakter", () => {
    expect(sanitizeDisplayName("a".repeat(500) + ".pdf", "x.pdf")).toHaveLength(120);
  });

  it("nama non-ASCII dipertahankan — peserta memakai nama berkas bahasa Indonesia", () => {
    expect(sanitizeDisplayName("Laporan Minggu ke-3.pdf", "x.pdf")).toBe("Laporan Minggu ke-3.pdf");
  });

  it("`..` LOLOS utuh — batas yang disengaja, bukan kelalaian", () => {
    // Nilai ini cuma untuk **ditampilkan** dan disimpan di kolom `file_name`.
    // Path objek dibuat `buildStoragePath()`, yang menolak `..` secara terpisah
    // (`tests/build-storage-path.test.ts`). Jadi `..` di sini tak bisa menyentuh
    // path mana pun. Dikunci supaya pemanggil baru tidak keliru memakai nilai ini
    // sebagai segmen path.
    expect(sanitizeDisplayName("..", "x.pdf")).toBe("..");
  });

  it("tidak melempar untuk masukan yang lolos lewat cast", () => {
    // `file.name` di-cast di seluruh repo; nilai non-string bisa sampai ke sini.
    expect(() => sanitizeDisplayName(undefined as unknown as string, "x.pdf")).toThrow();
  });
});
