/**
 * Aturan siapa boleh menghapus satu board, di satu tempat.
 *
 * Ditaruh di modul sendiri — BUKAN di `actions.ts` — karena berkas itu
 * `"use server"`, dan Next.js hanya mengizinkan fungsi async diekspor dari sana.
 * Fungsi ini sengaja sinkron dan tanpa I/O supaya bisa dipanggil dua kali dalam
 * satu render halaman tanpa menambah satu pun kueri.
 *
 * Alasan ia harus dipakai bersama oleh aksi DAN halaman: `getMentorBoards`
 * mengembalikan SELURUH board (memang begitu desainnya — daftar board bersifat
 * global), sementara penghapusannya dibatasi pemilik. Selama aturannya hidup
 * hanya di dalam aksi, halaman merender tombol sampah di board milik staf lain
 * dan menekannya tidak melakukan apa pun tanpa pesan apa pun.
 */
export function staffCanDeleteBoard(
  roleCodes: readonly string[],
  userId: string,
  ownerId: string | null,
) {
  if (roleCodes.includes("super_admin")) return true;

  // `task_boards.owner_id` adalah `on delete set null`
  // (`0001_initial_schema.sql`), jadi board yang pemiliknya dihapus menjadi
  // yatim. Tanpa cabang ini board itu mustahil dihapus siapa pun — termasuk
  // pembuatnya, yang sudah tidak ada.
  return ownerId === null || ownerId === userId;
}
