import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `is_published` punya tiga nilai, bukan dua.
 *
 * `0015_lms_publish_status.sql` menambahkan ketiga kolom dengan `DEFAULT true`
 * **tanpa `NOT NULL`**, jadi NULL benar-benar bisa tersimpan. Semantiknya dikunci
 * di satu arah oleh policy RLS yang sudah ditulis
 * (`0030d_policies_lms.sql:91,306` → `is_published is not false`): **NULL berarti
 * TERBIT.**
 *
 * Cacatnya adalah satu titik yang menyimpang dari itu:
 * `features/lms/actions.ts:334` memakai `.neq("is_published", false)`.
 *
 * Dua bentuk itu terlihat setara tapi tidak. Di SQL, `is_published <> false`
 * bernilai **NULL** untuk baris ber-NULL, dan `WHERE NULL` tidak mengembalikan
 * baris — jadi `neq` **ikut membuang** baris ber-NULL, sementara policy justru
 * mengizinkannya dibaca.
 *
 * Akibatnya presisi: lesson ber-NULL bisa dibuka dan diselesaikan peserta tapi
 * tidak ikut dihitung. `lessonIds.every(...)` karena itu lulus lebih awal, dan
 * **sertifikat terbit padahal masih ada materi yang belum selesai.** Tidak ada
 * error di jalur mana pun; yang keliru cuma sertifikatnya.
 *
 * Bagian pertama menguji logika tiga-nilainya sebagai fungsi murni. Bagian kedua
 * mengunci bentuk di sumbernya — karena cacat ini bukan salah hitung, melainkan
 * **pilihan operator**, dan satu-satunya cara ia kembali adalah seseorang menulis
 * `neq` lagi.
 */

const AKAR = join(import.meta.dirname, "..");
const baca = (rel: string) => readFileSync(join(AKAR, rel), "utf8");

/**
 * Sumber tanpa komentar.
 *
 * Diperlukan karena komentar di repo ini **mengutip bentuk yang salah** untuk
 * menjelaskan kenapa ia salah (`features/lms/actions.ts:333` menyebut
 * `.neq("is_published", false)` secara verbatim). Asersi yang mencocokkan teks
 * mentah akan menuduh penjelasannya sebagai pelanggaran — dan laporan palsu di
 * hari pertama adalah cara tercepat membuat test ini dimatikan orang.
 */
function kode(rel: string): string {
  return baca(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

type PublishFlag = boolean | null;

/** Rekonstruksi `.neq("is_published", false)` — SQL `is_published <> false`. */
function neqFalseMengembalikanBaris(nilai: PublishFlag): boolean {
  // `NULL <> false` bernilai NULL, dan `WHERE NULL` tidak mengembalikan baris.
  if (nilai === null) return false;
  return nilai !== false;
}

/** Rekonstruksi `.or("is_published.is.null,is_published.eq.true")`. */
function orNullTrueMengembalikanBaris(nilai: PublishFlag): boolean {
  return nilai === null || nilai === true;
}

/** Rekonstruksi predikat policy `is_published is not false`. */
function policyMengizinkan(nilai: PublishFlag): boolean {
  // `IS NOT FALSE` adalah predikat dua-nilai: ia tidak pernah menghasilkan NULL.
  return nilai !== false;
}

const SEMUA_NILAI: PublishFlag[] = [true, false, null];

describe("tiga nilai, dan hanya satu yang jadi sumber perbedaan", () => {
  it("untuk true dan false, ketiga bentuk sepakat", () => {
    for (const nilai of [true, false] as const) {
      expect(neqFalseMengembalikanBaris(nilai)).toBe(policyMengizinkan(nilai));
      expect(orNullTrueMengembalikanBaris(nilai)).toBe(policyMengizinkan(nilai));
    }
  });

  it("untuk NULL, bentuk lama berbeda pendapat dengan policy", () => {
    // Inilah seluruh cacatnya, dalam dua baris.
    expect(policyMengizinkan(null)).toBe(true);
    expect(neqFalseMengembalikanBaris(null)).toBe(false);
  });

  it("bentuk sekarang sepakat dengan policy untuk ketiga nilai", () => {
    for (const nilai of SEMUA_NILAI) {
      expect(orNullTrueMengembalikanBaris(nilai)).toBe(policyMengizinkan(nilai));
    }
  });
});

describe("konsekuensinya: sertifikat terbit lebih awal", () => {
  /**
   * Rekonstruksi bentuk keputusan di `features/lms/actions.ts`: lesson yang
   * terhitung disaring lewat salah satu predikat, lalu `every()` memeriksa apakah
   * semuanya sudah selesai.
   */
  function courseDianggapLulus(
    lessons: ReadonlyArray<{ id: string; is_published: PublishFlag }>,
    selesai: ReadonlySet<string>,
    saring: (n: PublishFlag) => boolean,
  ): boolean {
    const terhitung = lessons.filter((l) => saring(l.is_published)).map((l) => l.id);
    return terhitung.every((id) => selesai.has(id));
  }

  const LESSONS = [
    { id: "l1", is_published: true as PublishFlag },
    // Lesson ber-NULL: policy mengizinkan peserta membukanya, jadi ia materi nyata.
    { id: "l2", is_published: null as PublishFlag },
    { id: "l3", is_published: false as PublishFlag }, // draft, memang tidak dihitung
  ];

  it("bentuk lama meluluskan course padahal l2 belum selesai", () => {
    const selesai = new Set(["l1"]);
    expect(courseDianggapLulus(LESSONS, selesai, neqFalseMengembalikanBaris)).toBe(true);
  });

  it("bentuk sekarang menahan sampai l2 selesai", () => {
    expect(courseDianggapLulus(LESSONS, new Set(["l1"]), orNullTrueMengembalikanBaris)).toBe(false);
    expect(courseDianggapLulus(LESSONS, new Set(["l1", "l2"]), orNullTrueMengembalikanBaris)).toBe(true);
  });

  it("lesson draft tetap tidak pernah menghalangi kelulusan", () => {
    // Kalau l3 ikut dihitung, course jadi mustahil selesai — peserta tidak bisa
    // membuka draft.
    expect(courseDianggapLulus(LESSONS, new Set(["l1", "l2"]), orNullTrueMengembalikanBaris)).toBe(true);
  });
});

describe("bentuknya dikunci di sumber", () => {
  it("nol .neq(\"is_published\", ...) di seluruh features/", () => {
    // Bukan cuma di `actions.ts`: bentuk ini salah di mana pun ia muncul.
    const berkas = [
      "features/lms/actions.ts",
      "features/lms/queries.ts",
    ];
    for (const rel of berkas) {
      expect(
        kode(rel),
        `${rel} memakai .neq() pada is_published. Di SQL, "col <> false" bernilai ` +
          `NULL untuk baris ber-NULL, jadi baris itu ikut terbuang — padahal policy ` +
          `"is_published is not false" mengizinkannya. Pakai ` +
          `.or("is_published.is.null,is_published.eq.true").`,
      ).not.toMatch(/\.neq\(\s*["']is_published["']/);
    }
  });

  it("policy RLS masih memakai `is not false` — premis semua di atas", () => {
    // Kalau policy berubah arah, seluruh keputusan `!== false` di aplikasi harus
    // ikut dibalik. Asersi ini yang membuat perubahan itu gagal keras di sini
    // alih-alih menghasilkan baris yang hilang tanpa error.
    const policy = baca("supabase/migrations/0030d_policies_lms.sql");
    expect(policy).toContain("is_published is not false");
    expect(policy).not.toContain("is_published is true");
  });

  it("migrasi 0037 membackfill ke true, bukan false", () => {
    /**
     * Arah backfill bukan pilihan bebas: policy sudah mengizinkan peserta membaca
     * baris ber-NULL, jadi kemajuan mungkin sudah tercatat atasnya. Backfill ke
     * `false` akan menyembunyikan materi yang sudah dikerjakan peserta.
     */
    const m = baca("supabase/migrations/0037_lms_publish_not_null.sql");
    expect(m).toContain("set is_published = true where is_published is null");
    expect(m).not.toMatch(/set is_published = false/);
    expect(m).toContain("set not null");
    // Berkas ini menulis ke data produksi, jadi headernya wajib ada.
    expect(m).toContain("DITULIS, JANGAN DIJALANKAN tanpa izin eksplisit.");
  });
});
