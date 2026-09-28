import { randomInt } from "node:crypto";
import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";

/**
 * Nama constraint unik di `certificates` yang bisa ditabrak insert di bawah.
 * Keduanya berarti hal yang sangat berbeda, jadi keduanya tidak boleh
 * diperlakukan sama:
 *
 * - `INTERN_COURSE_CONSTRAINT` = peserta ini sudah punya sertifikat untuk course
 *   ini. Itu keadaan akhir yang benar, jadi idempoten: diamkan.
 * - `CERT_NUMBER_CONSTRAINT` = nomor acaknya kebetulan sudah terpakai orang lain.
 *   Itu bukan "sudah ada", itu undian yang kalah. Harus diundi ulang.
 *
 * Dicocokkan lewat teks pesan Postgres karena PostgREST tidak meneruskan nama
 * constraint di field tersendiri. Rapuh kalau nama constraint berubah — karena
 * itu cabang default-nya MELEMPAR, bukan mendiamkan. Nama yang tak dikenal jadi
 * kegagalan yang terlihat, bukan sertifikat yang hilang tanpa jejak.
 */
const INTERN_COURSE_CONSTRAINT = "idx_certificates_intern_course_unique";
const CERT_NUMBER_CONSTRAINT = "certificates_certificate_number_key";

/**
 * Berapa kali nomor sertifikat diundi ulang saat bertabrakan.
 *
 * Ruang nomornya hanya 9000 nilai per tahun (`CERT/LMS/<tahun>/<4 digit>`), dan
 * itu sempit: pada ~120 sertifikat setahun peluang minimal satu tabrakan sudah
 * di atas 50% (paradoks ulang tahun). Format itu dipertahankan karena nomor
 * sertifikat tercetak dan sudah dipakai jalur assessment, jadi tabrakannya
 * ditangani dengan mengundi ulang, bukan dengan memperlebar format.
 */
const MAX_NUMBER_ATTEMPTS = 8;

/**
 * Helper internal, BUKAN server action.
 * Sebelumnya file ini memakai "use server" sehingga fungsi ini terekspos
 * sebagai action ID tanpa guard apa pun: siapa saja bisa memanggilnya dengan
 * internProfileId/courseId sembarang dan menerbitkan sertifikat palsu.
 * Pemanggil (features/lms/actions.ts) yang bertanggung jawab memverifikasi
 * kepemilikan dan penyelesaian course sebelum memanggil ini.
 *
 * ## Kenapa fungsi ini tidak pernah berhasil sekali pun (B5.2 / H-12)
 *
 * Versi sebelumnya menulis `final_score` dan `notes` — dua kolom yang TIDAK ADA
 * di tabel `certificates` — dan tidak mengisi `assessment_id`, yang saat itu
 * `not null`. Jadi setiap insert ditolak database, selalu, sejak hari pertama.
 *
 * Yang membuatnya tak terlihat: errornya ditelan (`console.error` plus komentar
 * "Don't throw error, just log it"). Peserta menuntaskan seluruh course,
 * `course_enrollments.completed_at` terisi, halaman menampilkan course selesai —
 * dan sertifikatnya tidak ada. Tidak ada satu pun pesan gagal di antarmuka.
 *
 * Skema diperbaiki di `0035_fix_course_certificates.sql` (ditulis, belum
 * dijalankan): `final_score` + `notes` ditambahkan, `assessment_id` jadi
 * nullable, dan unique index parsial `(intern_id, course_id)` dipasang supaya
 * dua penyelesaian yang berbarengan tidak menerbitkan dua sertifikat.
 *
 * Fungsi ini sekarang MELEMPAR saat gagal. Konsekuensinya disengaja: pemanggil
 * (`markLessonCompleteAction`) sudah menyimpan progres lesson sebelum sampai ke
 * sini, jadi lemparan ini muncul sebagai pesan gagal di layar sementara
 * progresnya tetap tersimpan — persis pola yang sudah dipakai jalur assessment
 * di `features/assessments/actions.ts`. Lebih baik daripada keheningan yang
 * membuat sertifikat hilang tanpa ada yang tahu.
 */
export async function generateCourseCertificate(internProfileId: string, courseId: string) {
  const db = await createUteroAcademyServiceRoleClient();

  // Cek apakah sudah ada sertifikat untuk course ini.
  //
  // Ini optimasi, BUKAN penjaga: antara cek ini dan insert di bawah ada jeda
  // yang cukup untuk dua permintaan berbarengan lolos berdua. Jaminannya
  // ditegakkan `idx_certificates_intern_course_unique` di database, dan
  // tabrakannya ditangani di bawah.
  const { data: existing, error: existingError } = await db
    .from("certificates")
    .select("id")
    .eq("intern_id", internProfileId)
    .eq("course_id", courseId)
    .eq("certificate_type", "course_completion")
    .maybeSingle();

  // Kegagalan baca TIDAK boleh dibaca sebagai "belum ada". Kalau didiamkan,
  // insert di bawah tetap jalan dan mengandalkan unique index untuk menolaknya,
  // lalu penolakan itu diperlakukan sebagai sukses idempoten — sebuah kegagalan
  // baca yang berakhir terlihat seperti keberhasilan.
  if (existingError) {
    console.error("Gagal memeriksa sertifikat course yang sudah ada:", existingError);
    throw new Error("Progres tersimpan, namun status sertifikat tidak bisa diperiksa.");
  }

  if (existing) {
    return; // Sudah ada sertifikat, skip
  }

  const { data: course, error: courseError } = await db
    .from("courses")
    .select("title")
    .eq("id", courseId)
    .maybeSingle();

  if (courseError) {
    console.error("Gagal membaca judul course untuk sertifikat:", courseError);
    throw new Error("Progres tersimpan, namun data course untuk sertifikat gagal dibaca.");
  }

  // Judul course wajib ada. Versi lama jatuh ke `"Unknown Course"`, dan itu
  // tercetak apa adanya di badan sertifikat — dokumen resmi yang menyebut nama
  // course sebagai "Unknown Course". Lebih baik gagal dan bisa diperbaiki.
  const courseTitle = course?.title as string | undefined;
  if (!courseTitle) {
    throw new Error("Progres tersimpan, namun course tidak ditemukan sehingga sertifikat tidak diterbitkan.");
  }

  const year = new Date().getFullYear();

  for (let attempt = 1; attempt <= MAX_NUMBER_ATTEMPTS; attempt++) {
    // `randomInt` (CSPRNG), bukan `Math.random()`: nomor sertifikat adalah
    // pengenal dokumen resmi, dan keluaran `Math.random()` bisa diprediksi dari
    // keluaran sebelumnya. Ini bukan kontrol akses — pemilikannya diverifikasi
    // pemanggil — tapi nomor yang bisa ditebak berurutan tidak ada gunanya.
    const certificateNumber = `CERT/LMS/${year}/${randomInt(1000, 10000)}`;

    const { error } = await db.from("certificates").insert({
      intern_id: internProfileId,
      course_id: courseId,
      certificate_type: "course_completion",
      certificate_number: certificateNumber,
      final_score: 100, // Course completion = 100%
      status: "issued",
      issued_at: new Date().toISOString(),
      signed_at: new Date().toISOString(),
      notes: `Menyelesaikan course: ${courseTitle}`,
    });

    if (!error) {
      return;
    }

    if (error.code !== "23505") {
      console.error("Gagal generate course certificate:", error);
      throw new Error("Progres tersimpan, namun sertifikat penyelesaian course gagal diterbitkan.");
    }

    const message = `${error.message ?? ""} ${error.details ?? ""}`;

    // Sertifikat untuk pasangan (peserta, course) ini sudah ada — dibuat
    // permintaan lain yang menyelinap antara cek di atas dan insert ini.
    // Keadaan akhirnya sudah benar, jadi tidak ada yang perlu dilakukan.
    if (message.includes(INTERN_COURSE_CONSTRAINT)) {
      return;
    }

    // Nomornya bertabrakan. Undi ulang.
    if (message.includes(CERT_NUMBER_CONSTRAINT)) {
      continue;
    }

    // 23505 dari constraint yang tidak dikenal. Bisa jadi nama constraint
    // berubah, atau `0035` belum dijalankan sehingga `UNIQUE (assessment_id)`
    // lama masih yang menolak. Keduanya butuh manusia, dan keduanya TIDAK
    // boleh didiamkan — mendiamkannya persis bug yang sedang ditutup.
    console.error("Constraint unik tak dikenal saat generate course certificate:", error);
    throw new Error("Progres tersimpan, namun sertifikat penyelesaian course gagal diterbitkan.");
  }

  // Habis percobaan. Artinya ruang nomor untuk tahun ini praktis penuh, dan itu
  // masalah format yang butuh keputusan manusia — bukan sesuatu yang boleh
  // berakhir sebagai sertifikat yang hilang diam-diam.
  throw new Error(
    `Progres tersimpan, namun nomor sertifikat gagal dialokasikan setelah ${MAX_NUMBER_ATTEMPTS} percobaan.`,
  );
}
