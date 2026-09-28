import { describe, expect, it } from "vitest";
import {
  kunciJawaban,
  nilaiKuis,
  normalkanPertanyaan,
  uraikanNilaiKelulusan,
} from "@/features/lms/quiz-scoring";

/**
 * Kenapa berkas ini ada:
 *
 * Penilaian kuis patah di **tiga** tempat sekaligus dan tak satu pun melempar
 * error. Kuis "berhasil dibuat", pengumpulan "berhasil", skornya 0. Tidak ada log,
 * tidak ada pesan. Hanya test yang bisa menangkap kelas cacat ini.
 *
 * Karena kuis adalah dasar penerbitan sertifikat course
 * (`generateCourseCertificate`), skor yang selalu nol berarti **tidak ada peserta
 * yang bisa lulus** — dan tak seorang pun bisa tahu kenapa.
 *
 * Setiap kasus cacat lama ditulis dengan **asersi ganda**: bentuk lama dibuktikan
 * menghasilkan yang salah, bentuk sekarang menghasilkan yang benar. Jadi kembali
 * ke bentuk lama membuat test GAGAL, bukan cuma jadi dokumentasi.
 */

/** Bentuk yang benar-benar ditulis `QuizFormBuilder` sebelum diperbaiki. */
const BENTUK_BUILDER = [
  { id: 1, question: "Apa itu React?", options: ["Library", "Bahasa", "OS", "DB"], answer: 0 },
  { id: 2, question: "JSX itu?", options: ["Sintaks", "Server", "Linter", "CSS"], answer: 0 },
];

/** Bentuk kanonik sesuai `docs/lms/01-analisis-fitur-lms.md`. */
const BENTUK_DOKUMEN = [
  {
    id: 1,
    question: "Apa itu React?",
    options: ["Library", "Bahasa", "OS", "DB"],
    correct_answer: "Library",
  },
];

/** Pengganti `formData.get` — halaman peserta mengirim TEKS opsi, bukan indeks. */
function jawab(peta: Record<string, string>) {
  return (nama: string) => (nama in peta ? peta[nama] : null);
}

describe("cacat 1 — nama field form tidak cocok saat kuis dibuat", () => {
  it("membuktikan `formData.get(\"questions\")` menghasilkan kuis tanpa pertanyaan", () => {
    // Builder memancarkan `name="questionsJson"`. Action lama membaca `"questions"`.
    const form = new FormData();
    form.set("questionsJson", JSON.stringify(BENTUK_BUILDER));

    // Ini persis jalur lamanya, sampai akhir.
    const lama = form.get("questions") as string;
    expect(lama).toBeNull();
    expect(JSON.parse(lama || "[]")).toEqual([]);

    // Dan kuis berisi nol pertanyaan memberi skor 0 untuk setiap peserta —
    // tanpa satu pun error.
    expect(nilaiKuis([], jawab({})).score).toBe(0);

    // Nama yang benar memulihkan kedua pertanyaannya.
    expect(normalkanPertanyaan(JSON.parse(form.get("questionsJson") as string))).toHaveLength(2);
  });

  it("menolak kuis tanpa pertanyaan alih-alih menyimpannya diam-diam", () => {
    expect(() => normalkanPertanyaan([])).toThrow(/minimal satu pertanyaan/i);
    expect(() => normalkanPertanyaan(null)).toThrow(/minimal satu pertanyaan/i);
    // `JSON.parse("[]")` dari field yang hilang mendarat di sini juga, jadi
    // cacat 1 sekarang gagal-keras walau nama field-nya kembali salah.
    expect(() => normalkanPertanyaan(JSON.parse("[]"))).toThrow();
  });
});

describe("cacat 2 — kunci `answer` vs `correct_answer`", () => {
  it("membuktikan `q.correct_answer` undefined untuk bentuk builder", () => {
    const q = BENTUK_BUILDER[0] as { correct_answer?: unknown };
    expect(q.correct_answer).toBeUndefined();
    // Cacat lamanya: `ans === q.correct_answer`. Jawaban BENAR pun `false`.
    expect(("Library" as unknown) === q.correct_answer).toBe(false);

    // Sekarang aliasnya diselesaikan lewat `options`.
    expect(kunciJawaban(BENTUK_BUILDER[0])).toBe("Library");
  });

  it("menilai bentuk builder dengan benar — dulu selalu 0", () => {
    const hasil = nilaiKuis(BENTUK_BUILDER, jawab({ q_1: "Library", q_2: "Sintaks" }));
    expect(hasil.score).toBe(100);
    expect(hasil.correctCount).toBe(2);
    expect(hasil.tidakTerskor).toBe(0);
  });

  it("menilai bentuk dokumen dengan benar juga — kedua bentuk hidup di produksi", () => {
    expect(nilaiKuis(BENTUK_DOKUMEN, jawab({ q_1: "Library" })).score).toBe(100);
    expect(nilaiKuis(BENTUK_DOKUMEN, jawab({ q_1: "OS" })).score).toBe(0);
  });
});

describe("cacat 3 — indeks dibandingkan dengan teks opsi", () => {
  it("membuktikan teks tak pernah sama dengan indeks", () => {
    // Bahkan kalau nama kuncinya diperbaiki jadi `answer`, ini tetap `false`.
    expect(("Library" as unknown) === (0 as unknown)).toBe(false);
    // `nilaiKuis` menyelesaikan indeks jadi teks LEBIH DULU, jadi cocok.
    expect(nilaiKuis(BENTUK_BUILDER, jawab({ q_1: "Library" })).correctCount).toBe(1);
  });

  it("indeks bukan-nol diselesaikan ke opsi yang benar", () => {
    const q = { id: 9, question: "x", options: ["a", "b", "c"], answer: 2 };
    expect(kunciJawaban(q)).toBe("c");
    expect(nilaiKuis([q], jawab({ q_9: "c" })).score).toBe(100);
    expect(nilaiKuis([q], jawab({ q_9: "a" })).score).toBe(0);
  });

  it("indeks berbentuk string diterima di alias `answer`", () => {
    // `answer` tak pernah bermakna teks, jadi "1" di sana tidak ambigu.
    expect(kunciJawaban({ options: ["a", "b"], answer: "1" as unknown })).toBe("b");
  });

  it("string di `correct_answer` SELALU teks, tidak pernah indeks", () => {
    // Ini titik ambigu yang harus diputuskan sekali dan dikunci. Opsi bertulis
    // "1"/"2"/"3" membuat `correct_answer: "2"` bisa berarti dua hal: opsi
    // bertulis "2", atau opsi ke-3. Karena bentuk kanoniknya TEKS, artinya yang
    // pertama. Kalau cabang indeks didahulukan, setiap kuis berpilihan angka —
    // skala 1-5, tahun, nomor pasal — akan dinilai salah tanpa suara.
    expect(kunciJawaban({ options: ["1", "2", "3"], correct_answer: "2" })).toBe("2");
    // Dan string yang tak ada di `options` tetap dikembalikan apa adanya, bukan
    // dipaksa jadi indeks: `nilaiKuis` lalu menilainya "tak ada yang benar", yang
    // jujur. Menebak indeks akan memberi jawaban benar yang tak pernah diminta.
    expect(kunciJawaban({ options: ["a", "b"], correct_answer: "1" })).toBe("1");
    expect(nilaiKuis([{ id: 1, options: ["a", "b"], correct_answer: "1" }], jawab({ q_1: "a" })).score)
      .toBe(0);
  });
});

describe("kunci jawaban rusak tidak boleh merugikan peserta", () => {
  it("tidak ikut jadi pembagi", () => {
    const daftar = [
      { id: 1, question: "a", options: ["x", "y"], correct_answer: "x" },
      // Kunci rusak: indeks di luar rentang.
      { id: 2, question: "b", options: ["x", "y"], answer: 7 },
    ];
    const hasil = nilaiKuis(daftar, jawab({ q_1: "x", q_2: "y" }));
    // 1 benar dari 1 yang bisa dinilai = 100, bukan 1/2 = 50.
    expect(hasil.score).toBe(100);
    expect(hasil.tidakTerskor).toBe(1);
  });

  it("semua kunci rusak → 0, bukan pembagian dengan nol", () => {
    const hasil = nilaiKuis([{ id: 1, question: "a", options: [] }], jawab({ q_1: "x" }));
    expect(hasil.score).toBe(0);
    expect(Number.isFinite(hasil.score)).toBe(true);
    expect(hasil.tidakTerskor).toBe(1);
  });

  it("indeks pecahan dan negatif ditolak, tidak dijepit", () => {
    // Menjepit `-1` jadi `0` atau `1.5` jadi `1` berarti MENEBAK jawaban benar,
    // dan tebakannya tak terlihat siapa pun.
    for (const answer of [-1, 1.5, 2, 99, Number.NaN, Infinity]) {
      expect(kunciJawaban({ options: ["a", "b"], answer }), String(answer)).toBeNull();
    }
  });

  it("correct_answer kosong atau spasi dianggap rusak, bukan jawaban kosong", () => {
    expect(kunciJawaban({ options: ["a"], correct_answer: "" })).toBeNull();
    expect(kunciJawaban({ options: ["a"], correct_answer: "   " })).toBeNull();
  });

  it("opsi yang ditunjuk indeks ternyata kosong → rusak", () => {
    expect(kunciJawaban({ options: ["", "b"], answer: 0 })).toBeNull();
  });

  it("bentuk tak dikenal sama sekali → rusak, bukan melempar", () => {
    expect(kunciJawaban({})).toBeNull();
    expect(kunciJawaban({ options: "bukan array" as unknown, correct_answer: 0 })).toBeNull();
    expect(kunciJawaban({ correct_answer: true as unknown, options: ["a"] })).toBeNull();
  });
});

describe("jawaban peserta", () => {
  it("tidak menjawab → salah, bukan error", () => {
    const hasil = nilaiKuis(BENTUK_BUILDER, jawab({ q_1: "Library" }));
    expect(hasil.score).toBe(50);
    expect(hasil.jawaban).toEqual([
      { question_id: "1", selected_option: "Library" },
      { question_id: "2", selected_option: "" },
    ]);
  });

  it("memangkas spasi di ujung — radio bisa membawa whitespace dari JSONB", () => {
    expect(nilaiKuis(BENTUK_DOKUMEN, jawab({ q_1: "  Library  " })).score).toBe(100);
  });

  it("string kosong tidak pernah dianggap benar, bahkan kalau kuncinya rusak", () => {
    // Penting: `"" === ""` akan `true` kalau kuncinya tidak diperiksa lebih dulu.
    const hasil = nilaiKuis([{ id: 1, question: "a", options: ["x"], correct_answer: "" }], jawab({ q_1: "" }));
    expect(hasil.correctCount).toBe(0);
  });

  it("perbandingannya peka huruf besar-kecil — teksnya dari daftar yang sama", () => {
    expect(nilaiKuis(BENTUK_DOKUMEN, jawab({ q_1: "library" })).score).toBe(0);
  });

  it("membulatkan skor seperti sebelumnya", () => {
    const tiga = [
      { id: 1, question: "a", options: ["x", "y"], correct_answer: "x" },
      { id: 2, question: "b", options: ["x", "y"], correct_answer: "x" },
      { id: 3, question: "c", options: ["x", "y"], correct_answer: "x" },
    ];
    // `Math.round(1/3 * 100)` = 33 — bentuk yang sama dengan baris tersimpan.
    expect(nilaiKuis(tiga, jawab({ q_1: "x" })).score).toBe(33);
    expect(nilaiKuis(tiga, jawab({ q_1: "x", q_2: "x" })).score).toBe(67);
  });

  it("questions bukan array → 0, bukan lempar", () => {
    for (const mentah of [null, undefined, "[]", 42, {}]) {
      expect(nilaiKuis(mentah, jawab({})).score, String(mentah)).toBe(0);
    }
  });

  it("elemen bukan objek diabaikan, tidak merobohkan seluruh penilaian", () => {
    const hasil = nilaiKuis(
      [null, "x", BENTUK_DOKUMEN[0]] as unknown,
      jawab({ q_1: "Library" }),
    );
    expect(hasil.score).toBe(100);
  });

  it("nama field mengikuti `q.id` apa adanya — sama dengan yang dipancarkan React", () => {
    const dilihat: string[] = [];
    nilaiKuis([{ id: "abc-1", question: "a", options: ["x"], correct_answer: "x" }], (n) => {
      dilihat.push(n);
      return null;
    });
    expect(dilihat).toEqual(["q_abc-1"]);
  });
});

describe("normalkanPertanyaan — gerbang tulis", () => {
  it("mengubah bentuk builder jadi kanonik", () => {
    expect(normalkanPertanyaan(BENTUK_BUILDER)).toEqual([
      { id: 1, question: "Apa itu React?", options: ["Library", "Bahasa", "OS", "DB"], correct_answer: "Library" },
      { id: 2, question: "JSX itu?", options: ["Sintaks", "Server", "Linter", "CSS"], correct_answer: "Sintaks" },
    ]);
  });

  it("hasilnya bisa dinilai — asersi yang mengikat tulis dan baca", () => {
    // Inilah asersi yang mencegah cacat 2 dan 3 kembali dalam bentuk apa pun:
    // apa yang ditulis HARUS bisa dinilai oleh penilai.
    const tersimpan = normalkanPertanyaan(BENTUK_BUILDER);
    const hasil = nilaiKuis(tersimpan, jawab({ q_1: "Library", q_2: "Sintaks" }));
    expect(hasil.score).toBe(100);
    expect(hasil.tidakTerskor).toBe(0);
  });

  it("membuang opsi kosong dari empat kotak bawaan builder", () => {
    // Builder selalu membuat 4 kotak; admin sering mengisi 2.
    const hasil = normalkanPertanyaan([
      { id: 1, question: "a", options: ["x", "y", "", ""], answer: 1 },
    ]);
    expect(hasil[0].options).toEqual(["x", "y"]);
    expect(hasil[0].correct_answer).toBe("y");
  });

  it("menolak kalau indeks kunci menunjuk opsi yang tersaring habis", () => {
    // `answer: 3` menunjuk kotak kosong. Dulu tersimpan dan memberi 0 selamanya.
    expect(() => normalkanPertanyaan([{ id: 1, question: "a", options: ["x", "y", "", ""], answer: 3 }]))
      .toThrow(/kunci jawaban yang sah/i);
  });

  it("menolak pertanyaan kosong, opsi kurang dari dua, dan opsi duplikat", () => {
    expect(() => normalkanPertanyaan([{ question: "   ", options: ["x", "y"], answer: 0 }]))
      .toThrow(/masih kosong/i);
    expect(() => normalkanPertanyaan([{ question: "a", options: ["x"], answer: 0 }]))
      .toThrow(/minimal dua pilihan/i);
    // Opsi duplikat membuat benar dan salah mengirim teks yang sama.
    expect(() => normalkanPertanyaan([{ question: "a", options: ["x", "x"], answer: 0 }]))
      .toThrow(/sama dua kali/i);
  });

  it("menyebut nomor pertanyaan yang salah — pesannya harus bisa ditindaklanjuti", () => {
    expect(() =>
      normalkanPertanyaan([
        { question: "a", options: ["x", "y"], answer: 0 },
        { question: "", options: ["x", "y"], answer: 0 },
      ]),
    ).toThrow(/ke-2/);
  });

  it("memberi id kalau tidak ada — halaman peserta memancarkan q_undefined tanpanya", () => {
    const hasil = normalkanPertanyaan([{ question: "a", options: ["x", "y"], answer: 0 }]);
    expect(hasil[0].id).toBe(1);
  });

  it("mempertahankan id yang sudah ada — `Date.now()` dari builder", () => {
    expect(normalkanPertanyaan([{ id: 1759000000000, question: "a", options: ["x", "y"], answer: 0 }])[0].id)
      .toBe(1759000000000);
  });

  it("menolak elemen bukan objek", () => {
    expect(() => normalkanPertanyaan(["bukan objek"])).toThrow(/tidak berbentuk objek/i);
  });
});

describe("uraikanNilaiKelulusan", () => {
  it("membuktikan parseFloat lama menyimpan KKM null", () => {
    // `parseFloat("abc")` → NaN → `JSON.stringify` → null. Kuis ber-KKM null
    // tidak pernah bisa dinyatakan lulus.
    expect(Number.isNaN(parseFloat("abc"))).toBe(true);
    expect(JSON.parse(JSON.stringify({ p: parseFloat("abc") })).p).toBeNull();

    expect(() => uraikanNilaiKelulusan("abc")).toThrow(/angka antara/i);
  });

  it("menolak 70abc, bukan membacanya 70", () => {
    expect(parseFloat("70abc")).toBe(70);
    expect(() => uraikanNilaiKelulusan("70abc")).toThrow();
  });

  it("menolak di luar 0–100", () => {
    for (const mentah of ["-1", "101", "Infinity", "1e999"]) {
      expect(() => uraikanNilaiKelulusan(mentah), mentah).toThrow();
    }
  });

  it("kosong dan non-string jadi null — kolomnya nullable dan KKM opsional", () => {
    expect(uraikanNilaiKelulusan("")).toBeNull();
    expect(uraikanNilaiKelulusan("   ")).toBeNull();
    expect(uraikanNilaiKelulusan(null)).toBeNull();
    expect(uraikanNilaiKelulusan(undefined)).toBeNull();
  });

  it("menerima batas dan desimal", () => {
    expect(uraikanNilaiKelulusan("0")).toBe(0);
    expect(uraikanNilaiKelulusan("100")).toBe(100);
    expect(uraikanNilaiKelulusan(" 70.5 ")).toBe(70.5);
  });
});
