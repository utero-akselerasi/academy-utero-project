import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Test ini lahir dari kegagalan nyata, bukan dari kehati-hatian.
 *
 * 16 dari 42 berkas migrasi diawali BOM UTF-8 (`EF BB BF`). `scripts/migrate.mjs`
 * mengirim tiap berkas sebagai satu `client.query(sql)`, dan PostgreSQL menolak
 * BOM di awal statement dengan `42601 syntax error at or near "﻿"` pada posisi 1.
 * Artinya ke-16 berkas itu **tak pernah bisa** diterapkan lewat runner — padahal
 * tabel yang mereka buat ADA di produksi.
 *
 * Itu bukti independen untuk hipotesis penyimpangan produksi di plan: migrasi
 * diterapkan lewat jalur lain (psql CLI atau Supabase Studio, yang memaafkan BOM),
 * bukan lewat runner, sehingga tak ada catatan urutan maupun mana yang terlewat.
 *
 * Penyebabnya editor Windows yang menyimpan UTF-8 dengan BOM sebagai default.
 * Itu akan terulang. Karena itu aturannya dikunci di sini, bukan cuma diperbaiki
 * sekali — `npm test` sudah jadi langkah CI, jadi penambahan berkas ber-BOM
 * berikutnya gagal sebelum sampai ke database mana pun.
 */

const AKAR = join(import.meta.dirname, "..", "supabase");
const DIREKTORI = ["migrations", "seed", "manual"];

function berkasSql(sub: string): string[] {
  try {
    return readdirSync(join(AKAR, sub))
      .filter((n) => n.endsWith(".sql"))
      .map((n) => join(sub, n));
  } catch {
    // `manual/` bisa kosong atau tidak ada; itu bukan kegagalan.
    return [];
  }
}

const SEMUA = DIREKTORI.flatMap(berkasSql);

describe("berkas SQL harus bisa dikirim sebagai satu query", () => {
  it("menemukan berkas untuk diperiksa — kalau nol, glob-nya yang rusak", () => {
    // Tanpa asersi ini, direktori yang salah membuat seluruh describe lolos
    // dengan nol test dan tampak hijau.
    expect(SEMUA.length).toBeGreaterThan(40);
  });

  it.each(SEMUA)("%s tidak diawali BOM UTF-8", (relatif) => {
    const buf = readFileSync(join(AKAR, relatif));
    const adaBom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
    expect(
      adaBom,
      `${relatif} diawali BOM UTF-8. PostgreSQL menolaknya dengan 42601 saat ` +
        `berkasnya dikirim lewat client.query(). Simpan ulang sebagai UTF-8 tanpa BOM.`,
    ).toBe(false);
  });

  it.each(SEMUA)("%s tidak memuat BOM di tengah berkas", (relatif) => {
    // Menggabungkan dua berkas ber-BOM menaruh BOM di tengah, tempat ia jadi
    // lebih sulit terlihat daripada di awal.
    const isi = readFileSync(join(AKAR, relatif), "utf8");
    expect(isi.includes("﻿"), `${relatif} memuat U+FEFF`).toBe(false);
  });
});

describe("penamaan migrasi harus cocok dengan penemuan runner", () => {
  /**
   * `scripts/migrate.mjs` menemukan berkas dengan `/^(\d{4}[a-z]?)_.+\.sql$/`.
   * Berkas di `migrations/` yang tidak cocok **diabaikan diam-diam** — tidak ada
   * peringatan, tidak ada error. Berkas migrasi yang tak pernah jalan dan tak
   * pernah mengeluh adalah kegagalan paling mahal di direktori ini.
   */
  const POLA = /^(\d{4}[a-z]?)_.+\.sql$/;
  const MIGRASI = readdirSync(join(AKAR, "migrations")).filter((n) => n.endsWith(".sql"));

  it.each(MIGRASI)("%s cocok dengan pola penemuan runner", (nama) => {
    expect(POLA.test(nama), `${nama} akan diabaikan diam-diam oleh migrate.mjs`).toBe(true);
  });

  it("tidak ada dua berkas dengan prefix versi sama", () => {
    // Runner menolak jalan kalau ini terjadi; lebih baik ketahuan di test.
    const versi = MIGRASI.map((n) => POLA.exec(n)?.[1]).filter(Boolean) as string[];
    expect(new Set(versi).size, `versi duplikat di: ${versi.join(", ")}`).toBe(versi.length);
  });

  it("urutan leksikal = urutan numerik", () => {
    // Angka ber-nol-depan membuat keduanya sama. Asersi ini yang membuat sufiks
    // huruf (`0030a`, `0032b`) aman dipakai untuk pecahan domain.
    const urut = [...MIGRASI].sort();
    const nomor = urut.map((n) => POLA.exec(n)![1]);
    expect(nomor).toEqual([...nomor].sort());
  });
});
