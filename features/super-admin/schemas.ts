import { z } from "zod";

/**
 * Skema dan konstanta super-admin yang BUKAN aksi.
 *
 * Ditaruh di modul sendiri — bukan di `actions.ts` — karena berkas itu
 * `"use server"`, dan Next.js hanya mengizinkan fungsi async diekspor dari sana.
 * Satu `const` array atau satu skema zod yang diekspor dari berkas itu
 * membatalkan seluruh build. Pola yang sama sudah dipakai
 * `features/tasks/board-permissions.ts`.
 *
 * Isi berkas ini juga perlu dibaca komponen server (dropdown status magang),
 * jadi ia harus bisa diimpor dari dua sisi tanpa menarik seluruh aksi ikut.
 */

/**
 * Nilai enum `utero_academy.internship_status` (`0001_initial_schema.sql`).
 *
 * Keenamnya disalin persis dari enum. Ini yang menutup cacat nyata, bukan cacat
 * teoretis: dropdown di `app/dashboard/super-admin/schools/page.tsx` sebelumnya
 * menawarkan **`inactive`**, yang bukan anggota enum ini. Memilihnya membuat
 * Postgres menolak seluruh `update` dengan `22P02 invalid input value for enum`,
 * dan pesan mentah itu ditempelkan langsung ke muka super admin lewat
 * `"Gagal memperbarui periode magang: " + error.message` — sementara perubahan
 * tanggal dan jurusan di form yang sama ikut hilang tanpa penjelasan.
 *
 * Divalidasi di aplikasi meski DB sudah menolak: pesan "Status magang tidak
 * valid." bisa dibaca, dan nilai asing berhenti sebelum menyentuh kueri.
 */
export const internshipStatusSchema = z.enum([
  "pending",
  "active",
  "paused",
  "completed",
  "failed",
  "alumni",
]);

/**
 * Untuk dropdown: label Indonesia per nilai enum, satu sumber kebenaran.
 *
 * Diturunkan dari `internshipStatusSchema` lewat tipe, jadi menambah anggota enum
 * tanpa menambah labelnya menjadi error kompilasi — bukan opsi yang hilang diam-diam
 * dari UI, yang justru cara `paused`/`failed`/`alumni` dulu tak pernah terjangkau.
 */
export const INTERNSHIP_STATUS_OPTIONS: ReadonlyArray<{
  value: z.infer<typeof internshipStatusSchema>;
  label: string;
}> = [
  { value: "pending", label: "Menunggu" },
  { value: "active", label: "Aktif" },
  { value: "paused", label: "Dijeda" },
  { value: "completed", label: "Selesai" },
  { value: "failed", label: "Tidak Lulus" },
  { value: "alumni", label: "Alumni" },
];

export const updateInternPeriodSchema = z.object({
  internId: z.string().uuid("Siswa wajib dipilih."),
  // Kosong berarti "tidak diubah dari default", bukan nilai asing — form
  // mengirim string kosong untuk tanggal yang belum diisi.
  status: internshipStatusSchema.optional(),
});
