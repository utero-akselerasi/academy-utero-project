import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  INTERNSHIP_STATUS_OPTIONS,
  internshipStatusSchema,
  updateInternPeriodSchema,
} from "@/features/super-admin/schemas";

/**
 * Dropdown status magang menawarkan nilai yang bukan anggota enum.
 *
 * `app/dashboard/super-admin/schools/page.tsx` dulu menulis tangan empat opsi:
 * `active`, `completed`, **`inactive`**, `pending`. `utero_academy.internship_status`
 * (`0001_initial_schema.sql:14-21`) tidak punya `inactive`.
 *
 * Ini bukan kegagalan senyap — ia gagal keras, di muka super admin: Postgres
 * menolak seluruh `update` dengan `22P02 invalid input value for enum`, dan pesan
 * mentah itu dulu ditempelkan langsung ke antarmuka lewat
 * `"Gagal memperbarui periode magang: " + error.message`. Perubahan tanggal dan
 * jurusan di form yang sama ikut hilang, karena satu `update` menanggung semuanya.
 *
 * Cacat kedua di berkas yang sama lebih sunyi: tiga nilai enum yang sah —
 * `paused`, `failed`, `alumni` — **tidak pernah muncul di UI mana pun**, jadi tak
 * ada cara menyetelnya dari aplikasi.
 *
 * Kedua cacat itu satu akar: daftar opsi ditulis tangan terpisah dari enum. Karena
 * itu yang diuji di sini adalah **hubungannya**, bukan isi daftarnya.
 */

const AKAR = join(import.meta.dirname, "..");
const baca = (rel: string) => readFileSync(join(AKAR, rel), "utf8");

/** Anggota enum, dibaca dari migrasi — bukan disalin ke test ini. */
function anggotaEnumDariMigrasi(): string[] {
  const sql = baca("supabase/migrations/0001_initial_schema.sql");
  const m = /create type utero_academy\.internship_status as enum \(([^)]*)\)/i.exec(sql);
  if (!m) throw new Error("Definisi enum internship_status tidak ditemukan di 0001.");
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

describe("enum adalah sumber kebenarannya, bukan daftar yang ditulis tangan", () => {
  it("skema zod memuat persis anggota enum — tidak lebih, tidak kurang", () => {
    // Dibandingkan sebagai himpunan: urutan di zod tidak harus sama dengan SQL.
    expect(new Set(internshipStatusSchema.options)).toEqual(new Set(anggotaEnumDariMigrasi()));
  });

  it("setiap opsi dropdown adalah anggota enum", () => {
    // Inilah asersi yang akan menangkap `inactive` kembali.
    for (const opsi of INTERNSHIP_STATUS_OPTIONS) {
      expect(
        internshipStatusSchema.options as readonly string[],
        `"${opsi.value}" bukan anggota utero_academy.internship_status. Postgres akan ` +
          `menolak seluruh update dengan 22P02.`,
      ).toContain(opsi.value);
    }
  });

  it("setiap anggota enum bisa dipilih dari dropdown", () => {
    // Cacat kedua: `paused`/`failed`/`alumni` sah tapi dulu tak terjangkau.
    const ditawarkan = new Set(INTERNSHIP_STATUS_OPTIONS.map((o) => o.value));
    for (const nilai of internshipStatusSchema.options) {
      expect(
        ditawarkan.has(nilai),
        `"${nilai}" adalah nilai enum yang sah tapi tidak ada di dropdown — ` +
          `tidak ada cara menyetelnya dari aplikasi.`,
      ).toBe(true);
    }
  });

  it("tidak ada label ganda maupun nilai ganda", () => {
    const nilai = INTERNSHIP_STATUS_OPTIONS.map((o) => o.value);
    const label = INTERNSHIP_STATUS_OPTIONS.map((o) => o.label);
    expect(new Set(nilai).size).toBe(nilai.length);
    // Label ganda tidak merusak data, tapi membuat dua opsi tak bisa dibedakan.
    expect(new Set(label).size).toBe(label.length);
  });
});

describe("validasi menghentikan nilai asing sebelum menyentuh kueri", () => {
  // UUID v4 yang sah. Bukan `1111-...`: zod memvalidasi nibble versi dan varian,
  // jadi UUID "bulat" yang sering dipakai di test justru ditolak.
  const ID = "3f2b9c1e-7a4d-4e8b-9c2f-5d6a1b3c8e70";

  it("`inactive` ditolak dengan pesan yang bisa dibaca", () => {
    const hasil = updateInternPeriodSchema.safeParse({ internId: ID, status: "inactive" });
    expect(hasil.success).toBe(false);
  });

  it("status kosong berarti tidak diubah, bukan nilai asing", () => {
    // Form mengirim string kosong untuk field yang belum diisi; aksinya
    // menerjemahkannya ke `undefined` sebelum parse.
    const hasil = updateInternPeriodSchema.safeParse({ internId: ID, status: undefined });
    expect(hasil.success).toBe(true);
    expect(hasil.success && hasil.data.status).toBeUndefined();
  });

  it("internId non-UUID ditolak dengan pesan Indonesia", () => {
    const hasil = updateInternPeriodSchema.safeParse({ internId: "bukan-uuid" });
    expect(hasil.success).toBe(false);
    expect(hasil.success === false && hasil.error.issues[0]?.message).toMatch(/Siswa wajib dipilih/);
  });

  it("keenam nilai enum lolos", () => {
    for (const nilai of internshipStatusSchema.options) {
      expect(
        updateInternPeriodSchema.safeParse({ internId: ID, status: nilai }).success,
        `"${nilai}" seharusnya lolos`,
      ).toBe(true);
    }
  });
});

describe("bentuknya dikunci di sumber", () => {
  const HALAMAN = "app/dashboard/super-admin/schools/page.tsx";

  it("halaman tidak lagi menulis tangan satu pun <option value=...>", () => {
    // Satu opsi tertulis tangan cukup untuk menghidupkan kembali kedua cacatnya.
    expect(
      baca(HALAMAN),
      `${HALAMAN} menulis tangan <option value="...">. Turunkan dari ` +
        `INTERNSHIP_STATUS_OPTIONS supaya enum tetap satu sumber kebenaran.`,
    ).not.toMatch(/<option\s+value="[^"]/);
  });

  it("halaman memakai INTERNSHIP_STATUS_OPTIONS", () => {
    expect(baca(HALAMAN)).toContain("INTERNSHIP_STATUS_OPTIONS");
  });

  it("aksinya tidak lagi menempelkan error.message ke antarmuka", () => {
    /**
     * `error.message` berisi teks mentah PostgreSQL — nama kolom, nama constraint,
     * nama enum. Itu tidak membantu super admin dan membocorkan bentuk skema.
     */
    const aksi = baca("features/super-admin/actions.ts");
    expect(aksi).not.toContain("Gagal memperbarui periode magang: \" + error.message");
    expect(aksi).not.toMatch(/Gagal memperbarui periode magang[^"]*\$\{error\.message\}/);
  });
});

describe("skema dan konstanta tidak boleh tinggal di berkas \"use server\"", () => {
  /**
   * Next.js hanya mengizinkan **fungsi async** diekspor dari berkas `"use server"`.
   * Satu `const` array atau satu skema zod yang diekspor dari sana membatalkan
   * seluruh build.
   *
   * Kesalahan ini sudah terjadi dua kali di repo ini — pertama pada
   * `staffCanDeleteBoard`, lalu pada `INTERNSHIP_STATUS_OPTIONS`. Karena itu
   * aturannya dikunci di test, bukan diandalkan pada ingatan.
   */
  const MODUL = [
    "features/super-admin/schemas.ts",
    "features/lms/schemas.ts",
    "features/tasks/board-permissions.ts",
  ];

  it.each(MODUL)("%s bukan berkas \"use server\"", (rel) => {
    const isi = baca(rel);
    expect(isi.trimStart().startsWith('"use server"')).toBe(false);
    expect(isi.trimStart().startsWith("'use server'")).toBe(false);
  });

  /**
   * `export type` dan `export interface` **tidak** dihitung pelanggaran: keduanya
   * dihapus seluruhnya saat kompilasi, jadi tak ada nilai yang sampai ke runtime
   * untuk dikeluhkan Next.js. `features/tasks/actions.ts:106` mengekspor
   * `type FormState` dan itu sah.
   *
   * Yang dilarang adalah **nilai**: `const`, `let`, `var`, `class`.
   */
  const AKSI = [
    "features/super-admin/actions.ts",
    "features/lms/actions.ts",
    "features/tasks/actions.ts",
  ];

  it.each(AKSI)("%s hanya mengekspor fungsi async dan tipe", (rel) => {
    const isi = baca(rel);
    expect(isi.trimStart().startsWith('"use server"'), `${rel} harus "use server"`).toBe(true);

    const pelanggaran = [...isi.matchAll(/^export\s+(const|let|var|class)\s+(\w+)/gm)]
      // `export const x = async () => {}` sah — ia fungsi async.
      .filter((m) => !/^export\s+const\s+\w+\s*=\s*async\b/.test(m[0]))
      .map((m) => m[2]);

    expect(
      pelanggaran,
      `${rel} adalah "use server" tapi mengekspor nilai non-fungsi: ${pelanggaran.join(", ")}. ` +
        `Next.js hanya mengizinkan fungsi async diekspor dari berkas "use server"; ` +
        `satu const array atau satu skema zod membatalkan seluruh build. ` +
        `Pindahkan ke modul schemas.ts.`,
    ).toEqual([]);
  });
});
