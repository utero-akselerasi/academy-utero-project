/**
 * Penilaian kuis, dipisah dari server action supaya bisa diuji.
 *
 * ## Kenapa ini bukan sekadar refactor
 *
 * Rantai kuis patah di **tiga** tempat sekaligus, dan ketiganya senyap — tak satu
 * pun melempar error, jadi kuis "berhasil dibuat" dan "berhasil dikumpulkan"
 * sementara skornya selalu nol.
 *
 * 1. **Nama field tidak cocok.** `QuizFormBuilder` mengirim
 *    `<input name="questionsJson">`, sedangkan `createQuizAction` membaca
 *    `formData.get("questions")`. Hasilnya `null`, lalu `JSON.parse(null || "[]")`
 *    → `[]`. Jadi **setiap kuis yang dibuat lewat builder tersimpan tanpa satu pun
 *    pertanyaan**, dan `questions.length > 0 ? ... : 0` membuat skornya nol.
 * 2. **Bentuk kunci tidak cocok.** Builder menulis `answer` (indeks numerik
 *    0-basis), penilai membaca `q.correct_answer` → `undefined`. `ans === undefined`
 *    selalu `false` untuk jawaban apa pun.
 * 3. **Satuan bandingannya tidak cocok.** Form pengumpulan mengirim **teks opsi**
 *    (`value={opt}` di halaman kuis peserta), sementara builder menyimpan
 *    **indeks**. Bahkan kalau nama kuncinya diperbaiki, `"Library" === 0` tetap
 *    `false`.
 *
 * Akibat gabungannya: setiap peserta mendapat 0, `passing_score` tak pernah
 * terlampaui, dan karena kuis adalah dasar kelulusan, ini mengunci peserta dari
 * hal yang bergantung padanya.
 *
 * ## Bentuk kanonik
 *
 * `correct_answer` berisi **teks opsi yang benar**, sesuai
 * `docs/lms/01-analisis-fitur-lms.md` (`"correct_answer": "Library"`) dan sesuai
 * apa yang form pengumpulan kirimkan.
 *
 * `QuizFormBuilder` dibiarkan tetap mengirim `answer` (indeks) — konversinya
 * dikerjakan `normalkanPertanyaan()` di sisi server. Alasannya: klien tidak boleh
 * jadi pihak yang menentukan bentuk simpanan. Kalau konversi ditaruh di komponen,
 * bentuk yang masuk DB bergantung pada versi JS yang sedang dimuat browser, dan
 * pemanggil lain (Studio, skrip impor) tak terikat aturan itu sama sekali.
 *
 * ## Kenapa penilainya tetap toleran bentuk lain
 *
 * Baris `quizzes` di produksi **sudah menyimpang** — sebagian dibuat lewat builder
 * yang patah, sebagian mungkin lewat Studio dengan bentuk dari dokumen. Penilai
 * yang hanya menerima satu bentuk akan memberi nol untuk sisanya, yaitu persis
 * kegagalan senyap yang sedang diperbaiki. Jadi `correct_answer` numerik
 * diselesaikan lewat array `options`, dan kunci `answer` diterima sebagai alias.
 * Toleransi ini **hanya di sisi baca**; yang ditulis selalu bentuk kanonik.
 */

/** Satu pertanyaan sebagaimana tersimpan di JSONB `quizzes.questions`. */
export type PertanyaanKuis = {
  id?: unknown;
  question?: unknown;
  options?: unknown;
  correct_answer?: unknown;
  /** Alias historis yang ditulis `QuizFormBuilder` versi lama: indeks 0-basis. */
  answer?: unknown;
};

export type HasilPenilaian = {
  /** 0–100, bulat. */
  score: number;
  /** Banyak pertanyaan yang jawabannya benar. */
  correctCount: number;
  /** Banyak pertanyaan yang kunci jawabannya tidak bisa ditentukan sama sekali. */
  tidakTerskor: number;
  jawaban: { question_id: string; selected_option: string }[];
};

/**
 * Menentukan teks jawaban benar untuk satu pertanyaan, atau `null` kalau tidak
 * bisa ditentukan.
 *
 * `null` **bukan** "jawabannya salah" — ia "kuncinya rusak". Bedanya penting:
 * pertanyaan tanpa kunci tidak boleh ikut jadi pembagi, karena kalau ikut, kunci
 * yang rusak menurunkan skor peserta yang tidak salah apa pun.
 */
export function kunciJawaban(q: PertanyaanKuis): string | null {
  const options = Array.isArray(q.options) ? q.options : [];

  // Bentuk kanonik: teks.
  if (typeof q.correct_answer === "string") {
    const teks = q.correct_answer.trim();
    if (teks !== "") return teks;
    // String kosong diperlakukan sebagai kunci rusak, bukan sebagai jawaban
    // "kosong" yang bisa dicocokkan — radio `required` di form membuat jawaban
    // kosong tak mungkin dikirim, jadi mencocokkannya hanya bisa salah.
    return null;
  }

  // Bentuk menyimpang: indeks. Diterima dari `correct_answer` maupun dari alias
  // `answer` yang ditulis builder versi lama.
  for (const kandidat of [q.correct_answer, q.answer]) {
    const idx = indeksSah(kandidat, options.length);
    if (idx !== null) {
      const opsi = options[idx];
      if (typeof opsi === "string" && opsi.trim() !== "") return opsi.trim();
      // Indeksnya sah tapi opsinya kosong → kunci rusak.
      return null;
    }
  }

  return null;
}

/**
 * Indeks 0-basis yang benar-benar menunjuk ke dalam `options`.
 *
 * `"2"` diterima karena JSONB yang pernah lewat form HTML bisa menyimpan angka
 * sebagai string. Pecahan dan di luar rentang ditolak — menjepitnya ke rentang
 * akan menebak jawaban benar, dan tebakan itu tak terlihat siapa pun.
 */
function indeksSah(nilai: unknown, panjang: number): number | null {
  if (panjang === 0) return null;

  let n: number;
  if (typeof nilai === "number") {
    n = nilai;
  } else if (typeof nilai === "string" && nilai.trim() !== "") {
    n = Number(nilai);
  } else {
    return null;
  }

  if (!Number.isInteger(n)) return null;
  if (n < 0 || n >= panjang) return null;
  return n;
}

/**
 * Nilai seluruh kuis.
 *
 * `ambilJawaban` memisahkan fungsi ini dari `FormData` supaya bisa diuji tanpa
 * merangkai request; pemanggilnya menyerahkan `(key) => formData.get(key)`.
 */
export function nilaiKuis(
  questions: unknown,
  ambilJawaban: (namaField: string) => string | null,
): HasilPenilaian {
  const daftar: PertanyaanKuis[] = Array.isArray(questions)
    ? questions.filter((q): q is PertanyaanKuis => typeof q === "object" && q !== null)
    : [];

  const jawaban: { question_id: string; selected_option: string }[] = [];
  let correctCount = 0;
  let tidakTerskor = 0;

  for (const [idx, q] of daftar.entries()) {
    // `q.id` dipakai membangun nama field radio di halaman peserta
    // (`name={`q_${q.id}`}`). Kalau `id` tidak ada, halaman itu memancarkan
    // `q_undefined` — jadi fallback ke indeks di sini akan mencari field yang
    // tidak pernah ada. Bentuk `String(q.id)` dipertahankan supaya sama persis
    // dengan yang dipancarkan React.
    const idField = `q_${String(q.id)}`;
    const dipilihMentah = ambilJawaban(idField);
    const dipilih = typeof dipilihMentah === "string" ? dipilihMentah.trim() : "";

    jawaban.push({
      question_id: q.id === undefined || q.id === null ? String(idx) : String(q.id),
      selected_option: dipilih,
    });

    const kunci = kunciJawaban(q);
    if (kunci === null) {
      tidakTerskor += 1;
      continue;
    }

    if (dipilih !== "" && dipilih === kunci) {
      correctCount += 1;
    }
  }

  // Pembaginya hanya pertanyaan yang BISA dinilai. Kalau pertanyaan berkunci
  // rusak ikut jadi pembagi, kunci yang rusak menurunkan skor peserta yang tidak
  // melakukan kesalahan apa pun — dan karena nilainya tetap tersimpan, tak ada
  // yang tahu penyebabnya.
  const terskor = daftar.length - tidakTerskor;
  const score = terskor > 0 ? Math.round((correctCount / terskor) * 100) : 0;

  return { score, correctCount, tidakTerskor, jawaban };
}

/**
 * Uraikan nilai kelulusan (KKM) dari form.
 *
 * `parseFloat` dulu dipakai langsung: `parseFloat("abc")` → `NaN`, lalu
 * `JSON.stringify(NaN)` → `null`, jadi `passing_score` tersimpan null. Kuis
 * ber-KKM null tidak pernah bisa dinyatakan lulus — cacat yang sama bentuknya
 * dengan `NaN` di penilaian penilaian peserta (`features/assessments/scoring.ts`).
 *
 * Kosong dikembalikan `null` dengan sengaja: kolomnya nullable dan KKM memang
 * opsional. Yang ditolak adalah nilai yang *diisi tapi tidak masuk akal*.
 */
export function uraikanNilaiKelulusan(mentah: unknown): number | null {
  if (typeof mentah !== "string") return null;

  const dipangkas = mentah.trim();
  if (dipangkas === "") return null;

  // `Number()`, bukan `parseFloat()`: `parseFloat("70abc")` → 70 tanpa suara.
  const nilai = Number(dipangkas);
  if (!Number.isFinite(nilai) || nilai < 0 || nilai > 100) {
    throw new Error("Nilai kelulusan harus berupa angka antara 0 s.d. 100.");
  }

  return nilai;
}

/**
 * Normalisasi daftar pertanyaan ke bentuk kanonik sebelum disimpan.
 *
 * Dipakai `createQuizAction`. Melempar kalau kuisnya tidak bisa dinilai sama
 * sekali — kuis tanpa pertanyaan atau tanpa kunci jawaban yang sah dulu tersimpan
 * tanpa keluhan lalu memberi nol ke setiap peserta.
 */
export function normalkanPertanyaan(mentah: unknown): PertanyaanKuis[] {
  if (!Array.isArray(mentah) || mentah.length === 0) {
    throw new Error("Kuis harus memuat minimal satu pertanyaan.");
  }

  return mentah.map((q, idx) => {
    if (typeof q !== "object" || q === null) {
      throw new Error(`Pertanyaan ke-${idx + 1} tidak berbentuk objek.`);
    }
    const p = q as PertanyaanKuis;

    const teksPertanyaan = typeof p.question === "string" ? p.question.trim() : "";
    if (teksPertanyaan === "") {
      throw new Error(`Pertanyaan ke-${idx + 1} masih kosong.`);
    }

    const options = (Array.isArray(p.options) ? p.options : [])
      .map((o) => (typeof o === "string" ? o.trim() : ""))
      .filter((o) => o !== "");
    if (options.length < 2) {
      throw new Error(`Pertanyaan ke-${idx + 1} butuh minimal dua pilihan jawaban.`);
    }
    if (new Set(options).size !== options.length) {
      // Opsi duplikat membuat jawaban benar tidak bisa dibedakan dari yang salah:
      // keduanya mengirim teks yang sama.
      throw new Error(`Pertanyaan ke-${idx + 1} memuat pilihan jawaban yang sama dua kali.`);
    }

    const kunci = kunciJawaban({ ...p, options });
    if (kunci === null || !options.includes(kunci)) {
      throw new Error(`Pertanyaan ke-${idx + 1} belum punya kunci jawaban yang sah.`);
    }

    return {
      id: p.id === undefined || p.id === null ? idx + 1 : p.id,
      question: teksPertanyaan,
      options,
      correct_answer: kunci,
    };
  });
}
