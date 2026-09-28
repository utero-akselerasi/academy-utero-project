import { describe, expect, it } from "vitest";
import { hitungSkorAspekTetap, hitungSkorKriteria } from "@/features/assessments/scoring";

/**
 * Kenapa fungsi ini yang dites, dan bukan guard-nya:
 *
 * `saveAssessmentAction` punya guard yang benar — `requireAdmin()` plus
 * `resolveStaffInternScope()` yang memastikan admin cuma menilai peserta yang
 * dibimbingnya. `tests/authorization-matrix.test.ts` sudah menguncinya. Tapi
 * matriks itu **statis**: ia memastikan guard dipanggil, bukan bahwa angka yang
 * lewat sesudahnya benar.
 *
 * Dan angka itulah yang menentukan penerbitan sertifikat: `submitType === "finalize"`
 * menyisipkan baris `certificates` ber-`status: "issued"` tanpa memeriksa ulang
 * `final_score`. Jadi hitungan yang salah = sertifikat yang salah, tanpa satu pun
 * error yang terlihat.
 *
 * Setiap kasus di bawah ditulis dengan **asersi ganda** untuk cacat lamanya:
 * bentuk lama dibuktikan meloloskannya, bentuk sekarang menolaknya.
 */

describe("NaN — cacat terparah: lolos setiap pemeriksaan rentang", () => {
  /**
   * Penjaga lamanya `if (scoreVal < 0 || scoreVal > 100) throw`. Dengan
   * `parseFloat("abc")` → `NaN`, KEDUA perbandingan `false`, jadi penjaganya tidak
   * kena sama sekali. `totalScore` jadi `NaN`, `finalScore` jadi `NaN`, lalu
   * `JSON.stringify` mengubahnya jadi `null` di badan request — baris tersimpan
   * `finalized` dengan skor null, dan sertifikat terbit.
   */
  it("membuktikan perbandingan dengan NaN selalu false — akar cacatnya", () => {
    const nan = parseFloat("abc");
    expect(Number.isNaN(nan)).toBe(true);
    expect(nan < 0).toBe(false);
    expect(nan > 100).toBe(false);
    // Inilah yang membuatnya tersimpan sebagai null alih-alih menggagalkan request.
    expect(JSON.parse(JSON.stringify({ s: nan })).s).toBeNull();
  });

  it.each(["abc", "-", "n/a", "tidak ada", "null", "undefined", "NaN"])(
    "menolak nilai kriteria %o",
    (mentah) => {
      // Bukti cacat lama: parseFloat menghasilkan NaN yang lolos kedua penjaga.
      const lama = parseFloat(mentah || "0");
      expect(Number.isNaN(lama) && !(lama < 0) && !(lama > 100)).toBe(true);

      const hasil = hitungSkorKriteria(["Teknis"], [mentah]);
      expect(hasil.ok).toBe(false);
    },
  );

  it("menolak Infinity dan -Infinity", () => {
    for (const mentah of ["Infinity", "-Infinity", "1e999"]) {
      expect(hitungSkorKriteria(["Teknis"], [mentah]).ok, mentah).toBe(false);
    }
  });

  it("menolak NaN di aspek tetap juga — jalur inilah yang default-nya dipakai UI", () => {
    const hasil = hitungSkorAspekTetap({ technical: "abc", discipline: "80", attitude: "90" });
    expect(hasil.ok).toBe(false);
  });

  it("finalScore selalu angka hingga ketika ok — asersi yang menutup jalur sertifikat", () => {
    // Satu asersi menyeluruh: kalau hasilnya `ok`, skornya TIDAK MUNGKIN NaN.
    // Itulah premis yang diandalkan penerbitan sertifikat.
    const hasil = hitungSkorKriteria(["A", "B"], ["80", "90"]);
    expect(hasil.ok).toBe(true);
    if (hasil.ok) {
      expect(Number.isFinite(hasil.finalScore)).toBe(true);
    }
  });
});

describe("parseFloat memotong sampah tanpa suara", () => {
  it("menolak 80abc, bukan membacanya sebagai 80", () => {
    // `parseFloat("80abc")` → 80. Nilai yang salah ketik jadi nilai sah tanpa
    // seorang pun tahu.
    expect(parseFloat("80abc")).toBe(80);
    expect(hitungSkorKriteria(["Teknis"], ["80abc"]).ok).toBe(false);
  });

  it("menolak 90 poin dan 85%", () => {
    for (const mentah of ["90 poin", "85%", "8 0"]) {
      expect(hitungSkorKriteria(["Teknis"], [mentah]).ok, mentah).toBe(false);
    }
  });
});

describe("kolom kosong bukan nol", () => {
  it("menolak string kosong alih-alih menganggapnya 0", () => {
    // `criteriaScores[idx] || "0"` mengubah kriteria yang belum diisi jadi nol
    // yang sah, jadi ia menekan rata-rata alih-alih ditolak.
    // Lewat variabel bertipe `string`, bukan literal: `"" || "0"` sebagai literal
    // dilaporkan tsc sebagai "always falsy" — betul, tapi yang sedang dibuktikan
    // adalah perilaku `||` atas nilai form yang tipenya `string`.
    const kosong: string = "";
    expect(parseFloat(kosong || "0")).toBe(0);
    expect(hitungSkorKriteria(["Teknis"], [""]).ok).toBe(false);
  });

  it("menolak spasi saja, dan indeks yang tidak ada sama sekali", () => {
    expect(hitungSkorKriteria(["Teknis"], ["   "]).ok).toBe(false);
    // Nama ada tapi nilainya tidak — `getAll()` bisa menghasilkan panjang beda.
    expect(hitungSkorKriteria(["Teknis", "Sikap"], ["80"]).ok).toBe(false);
  });

  it("menolak aspek tetap yang hilang", () => {
    expect(hitungSkorAspekTetap({ technical: "80", discipline: "90" }).ok).toBe(false);
    expect(hitungSkorAspekTetap({}).ok).toBe(false);
  });
});

describe("nama kriteria duplikat menggelembungkan rata-rata", () => {
  it("menolak duplikat, dan membuktikan dulu hasilnya 200", () => {
    // Cacat lama: `scoreJson[name]` menimpa kunci yang sama sehingga tinggal 1,
    // tapi `totalScore` menjumlah keduanya → 200 / 1 = 200. Skor di atas 100 lolos
    // karena pemeriksaan rentang berlaku per kriteria, bukan pada rata-ratanya.
    const scoreJson: Record<string, number> = {};
    let total = 0;
    for (const n of [100, 100]) {
      scoreJson["Teknis"] = n;
      total += n;
    }
    expect(total / Object.keys(scoreJson).length).toBe(200);

    expect(hitungSkorKriteria(["Teknis", "Teknis"], ["100", "100"]).ok).toBe(false);
  });

  it("menganggap nama berbeda spasi sebagai duplikat — bedanya tak terlihat di UI", () => {
    expect(hitungSkorKriteria(["Teknis", " Teknis "], ["80", "90"]).ok).toBe(false);
  });

  it("menolak nama kriteria kosong", () => {
    expect(hitungSkorKriteria([""], ["80"]).ok).toBe(false);
    expect(hitungSkorKriteria(["   "], ["80"]).ok).toBe(false);
  });

  it("menolak daftar kriteria kosong", () => {
    // Pemanggil memilih cabang ini hanya kalau `criteriaNames.length > 0`, jadi
    // ini penjaga untuk pemanggil baru.
    expect(hitungSkorKriteria([], []).ok).toBe(false);
  });
});

describe("hitungan yang benar", () => {
  it("rata-rata kriteria, bukan jumlah", () => {
    const hasil = hitungSkorKriteria(["A", "B", "C"], ["90", "80", "70"]);
    expect(hasil).toEqual({ ok: true, scoreJson: { A: 90, B: 80, C: 70 }, finalScore: 80 });
  });

  it("rata-rata aspek tetap dibagi tiga", () => {
    const hasil = hitungSkorAspekTetap({ technical: "90", discipline: "80", attitude: "70" });
    expect(hasil).toEqual({
      ok: true,
      scoreJson: { technical: 90, discipline: 80, attitude: 70 },
      finalScore: 80,
    });
  });

  it("membulatkan dua desimal dengan bentuk yang sama seperti baris tersimpan", () => {
    // `Math.round(x * 100) / 100` dipertahankan supaya baris lama dan baru
    // dibulatkan sama untuk masukan sama.
    const hasil = hitungSkorKriteria(["A", "B", "C"], ["80", "80", "81"]);
    expect(hasil.ok && hasil.finalScore).toBe(80.33);
  });

  it("menerima batas 0 dan 100 — inklusif", () => {
    expect(hitungSkorKriteria(["A", "B"], ["0", "100"])).toEqual({
      ok: true,
      scoreJson: { A: 0, B: 100 },
      finalScore: 50,
    });
  });

  it("menolak di luar batas, termasuk negatif dan 100.01", () => {
    for (const mentah of ["-1", "101", "100.01", "-0.5"]) {
      expect(hitungSkorKriteria(["A"], [mentah]).ok, mentah).toBe(false);
    }
  });

  it("menerima desimal dan memangkas spasi di ujung", () => {
    expect(hitungSkorKriteria(["A"], [" 87.5 "])).toEqual({
      ok: true,
      scoreJson: { A: 87.5 },
      finalScore: 87.5,
    });
  });

  it("satu kriteria: rata-ratanya nilai itu sendiri", () => {
    // Satu pemanggilan, disimpan: dua pemanggilan terpisah membuat penyempitan
    // `ok` dari yang pertama tidak berlaku untuk yang kedua.
    const hasil = hitungSkorKriteria(["A"], ["77"]);
    expect(hasil.ok && hasil.finalScore).toBe(77);
  });
});

describe("masukan bukan string — formData bisa mengembalikan File atau null", () => {
  it("menolak null dan undefined", () => {
    expect(hitungSkorAspekTetap({ technical: null, discipline: "80", attitude: "90" }).ok).toBe(false);
    expect(hitungSkorAspekTetap({ technical: undefined, discipline: "80", attitude: "90" }).ok).toBe(false);
  });

  it("menolak angka dan objek yang menyelinap lewat cast", () => {
    // `formData.get()` di-cast `as string` di seluruh repo, jadi nilai non-string
    // bisa sampai ke sini tanpa tsc mengeluh.
    expect(hitungSkorKriteria(["A"], [80 as unknown as string]).ok).toBe(false);
    expect(hitungSkorKriteria(["A"], [{} as unknown as string]).ok).toBe(false);
  });
});
