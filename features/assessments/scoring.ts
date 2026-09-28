/**
 * Perhitungan skor penilaian, dipisah dari server action supaya bisa diuji.
 *
 * Kenapa dipisah: logikanya dulu inline di `saveAssessmentAction`, bercampur
 * dengan guard, kueri DB, dan penerbitan sertifikat — jadi tidak ada cara
 * mengujinya tanpa Supabase. Dan justru fungsi inilah yang paling butuh diuji,
 * karena **kesalahannya tidak melempar**: ia mengembalikan angka yang salah, dan
 * angka itu langsung menentukan apakah sertifikat diterbitkan.
 *
 * Tiga cacat yang diperbaiki di sini, semuanya senyap:
 *
 * 1. **`NaN` lolos setiap pemeriksaan rentang.** `parseFloat("abc")` → `NaN`, dan
 *    `NaN < 0` maupun `NaN > 100` keduanya `false` — jadi penjaga
 *    `if (scoreVal < 0 || scoreVal > 100) throw` **tidak kena**. `totalScore`
 *    menjadi `NaN`, `finalScore` menjadi `NaN`, lalu `JSON.stringify(NaN)`
 *    menghasilkan `null` di badan request. Akibatnya: baris `assessments`
 *    tersimpan dengan `final_score` null, statusnya `finalized`, dan
 *    **sertifikat tetap diterbitkan**. Perbandingan dengan `NaN` selalu `false`,
 *    jadi pemeriksaan rentang mana pun akan meloloskannya — satu-satunya jalan
 *    adalah memeriksa keterhinggaan secara eksplisit.
 *
 * 2. **Nama kriteria duplikat menggelembungkan rata-rata.** `scoreJson[name]`
 *    menimpa kunci yang sama, tapi `totalScore += scoreVal` menjumlah keduanya.
 *    Dua kriteria bernama sama dengan nilai 100 memberi `totalScore` 200 dan
 *    `numCriteria` 1 → rata-rata 200. Pembaginya harus jumlah nilai yang
 *    benar-benar dijumlah, bukan jumlah kunci yang bertahan.
 *
 * 3. **`|| "0"` mengubah kolom kosong jadi nilai nol yang sah.** Kriteria yang
 *    belum diisi ikut menekan rata-rata alih-alih ditolak. Sekarang string kosong
 *    ditolak, bukan diterjemahkan.
 */

/** Hasil hitung, atau alasan kegagalan yang bisa ditampilkan ke pengguna. */
export type HasilSkor =
  | { ok: true; scoreJson: Record<string, number>; finalScore: number }
  | { ok: false; message: string };

const MIN = 0;
const MAX = 100;

/**
 * Mengurai satu nilai kriteria.
 *
 * `Number()`, bukan `parseFloat()`: `parseFloat("80abc")` mengembalikan `80` dan
 * membuang sisanya tanpa suara, sedangkan `Number("80abc")` → `NaN`. Untuk nilai
 * yang menentukan penerbitan sertifikat, menolak lebih benar daripada menebak.
 */
function uraikanNilai(mentah: string | null | undefined): number | null {
  if (typeof mentah !== "string") return null;

  const dipangkas = mentah.trim();
  // Kolom kosong bukan nol. `Number("")` → 0, jadi pemeriksaan ini harus
  // mendahuluinya.
  if (dipangkas === "") return null;

  const nilai = Number(dipangkas);

  // `Number.isFinite` menolak `NaN` DAN `Infinity` sekaligus. `Infinity` juga
  // lolos pemeriksaan rentah `< 0` tapi tidak `> 100`, jadi sebetulnya tertangkap
  // — tapi `-Infinity`/`NaN` tidak, dan menyatukan ketiganya di satu penjaga lebih
  // sulit salah daripada mengandalkan urutan perbandingan.
  if (!Number.isFinite(nilai)) return null;
  if (nilai < MIN || nilai > MAX) return null;

  return nilai;
}

/**
 * Hitung dari daftar kriteria bernama (bentuk kriteria dinamis di UI).
 *
 * Nama kriteria duplikat **ditolak**, bukan digabung: menggabungnya berarti
 * memilih nilai mana yang menang, dan pilihan itu tidak terlihat oleh penilai.
 */
export function hitungSkorKriteria(nama: string[], nilaiMentah: string[]): HasilSkor {
  if (nama.length === 0) {
    return { ok: false, message: "Minimal satu kriteria penilaian harus diisi." };
  }

  const scoreJson: Record<string, number> = {};
  let total = 0;
  let jumlah = 0;

  for (const [idx, namaKriteria] of nama.entries()) {
    const label = namaKriteria.trim();
    if (label === "") {
      return { ok: false, message: "Nama kriteria tidak boleh kosong." };
    }
    if (Object.prototype.hasOwnProperty.call(scoreJson, label)) {
      return { ok: false, message: `Kriteria "${label}" tercantum lebih dari sekali.` };
    }

    const nilai = uraikanNilai(nilaiMentah[idx]);
    if (nilai === null) {
      return {
        ok: false,
        message: `Nilai kriteria "${label}" harus berupa angka antara ${MIN} s.d. ${MAX}.`,
      };
    }

    scoreJson[label] = nilai;
    total += nilai;
    jumlah += 1;
  }

  // Pembaginya `jumlah` — banyaknya nilai yang benar-benar dijumlah. Dulu
  // `Object.keys(scoreJson).length`, yang berbeda begitu ada nama duplikat.
  return { ok: true, scoreJson, finalScore: bulatkanDuaDesimal(total / jumlah) };
}

/** Kunci tetap untuk bentuk penilaian tiga aspek. */
export const ASPEK_TETAP = ["technical", "discipline", "attitude"] as const;

const LABEL_ASPEK: Record<(typeof ASPEK_TETAP)[number], string> = {
  technical: "Teknis",
  discipline: "Kedisiplinan",
  attitude: "Sikap",
};

/** Hitung dari tiga aspek tetap. Ketiganya wajib — tidak ada default nol. */
export function hitungSkorAspekTetap(mentah: Record<string, string | null | undefined>): HasilSkor {
  const scoreJson: Record<string, number> = {};
  let total = 0;

  for (const aspek of ASPEK_TETAP) {
    const nilai = uraikanNilai(mentah[aspek]);
    if (nilai === null) {
      return {
        ok: false,
        message: `Nilai ${LABEL_ASPEK[aspek]} harus berupa angka antara ${MIN} s.d. ${MAX}.`,
      };
    }
    scoreJson[aspek] = nilai;
    total += nilai;
  }

  return { ok: true, scoreJson, finalScore: bulatkanDuaDesimal(total / ASPEK_TETAP.length) };
}

/**
 * Pembulatan dua desimal.
 *
 * Bentuk `Math.round(x * 100) / 100` dipertahankan karena itu yang sudah tersimpan
 * di baris `assessments` yang ada — menggantinya dengan `toFixed` akan membuat
 * baris lama dan baru dibulatkan berbeda untuk masukan yang sama.
 */
function bulatkanDuaDesimal(nilai: number): number {
  return Math.round(nilai * 100) / 100;
}
