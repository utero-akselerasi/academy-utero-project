import { z } from "zod";

/**
 * Nilai enum `utero_academy.publish_status` (`0001_initial_schema.sql`).
 *
 * Daftarnya disalin persis dari enum, dan urutannya ikut: `courses.status`
 * bertipe enum, jadi nilai di luar ketiga ini **ditolak Postgres**, bukan
 * tersimpan diam-diam. Yang divalidasi di sini karena itu bukan integritas data
 * melainkan **bentuk kegagalannya**: tanpa validasi, nilai asing lolos sampai DB
 * dan yang dilihat staf adalah pesan error mentah PostgreSQL, sementara log
 * aplikasi mencatat "Gagal update status course" tanpa menyebut nilai mana yang
 * salah.
 *
 * `courses.status` juga menentukan apakah sebuah course bisa didaftar peserta
 * (`enrollCourseAction`) dan muncul di katalog, jadi nilainya bagian dari
 * keputusan otorisasi — bukan sekadar label tampilan.
 */
export const publishStatusSchema = z.enum(["draft", "published", "archived"]);

export const updateCourseStatusSchema = z.object({
  courseId: z.string().uuid("Course ID tidak valid."),
  status: publishStatusSchema,
});
