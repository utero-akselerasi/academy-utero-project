/**
 * Aturan siapa boleh menghapus satu board, di satu tempat.
 *
 * Ditaruh di modul sendiri — BUKAN di `actions.ts` — karena berkas itu
 * `"use server"`, dan Next.js hanya mengizinkan fungsi async diekspor dari sana.
 * Fungsi ini sengaja sinkron dan tanpa I/O supaya bisa dipanggil dua kali dalam
 * satu render halaman tanpa menambah satu pun kueri.
 *
 * Admin mengelola seluruh papan dan harus mendapat aksi yang sama pada daftar.
 */
export function staffCanDeleteBoard(
  roleCodes: readonly string[],
  userId: string,
  ownerId: string | null,
) {
  if (roleCodes.includes("super_admin") || roleCodes.includes("admin")) return true;

  return ownerId === null || ownerId === userId;
}
