import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Ukuran halaman yang diminta per permintaan. Nilai konservatif: batas
 * `per_page` sisi server tidak diketahui dari repo ini, dan fungsi di bawah
 * sengaja dirancang supaya tetap benar kalau server memotongnya.
 */
const PAGE_SIZE = 200;

/**
 * Rem terhadap loop tanpa akhir: 500 halaman x 200 = 100.000 user. Ini bukan
 * batas kapasitas produk, cuma penjaga supaya bug sisi server tidak berubah
 * jadi loop yang menghabiskan memori proses. Kalau kena, fungsi MELEMPAR.
 */
const MAX_PAGES = 500;

/**
 * Ambil SELURUH user auth, menyusuri semua halaman.
 *
 * Kenapa ini ada: tiga titik pemanggil memakai `listUsers({ perPage: 1000 })`
 * satu kali dan memperlakukan hasilnya sebagai daftar user yang lengkap. Itu
 * salah dalam dua lapis sekaligus.
 *
 * 1. `perPage: 1000` kemungkinan besar melampaui batas `per_page` sisi server,
 *    dan pemotongannya senyap — yang kembali lebih sedikit dari 1000 tanpa
 *    error apa pun.
 * 2. Hasilnya dipakai membangun `Set` id user, lalu `Set` itu dipakai menilai
 *    baris lain sebagai yatim. User yang tidak terambil TIDAK ADA di set itu,
 *    jadi kontak sekolah miliknya terlihat menunjuk user yang sudah terhapus.
 *
 * Konsekuensi terburuknya bukan laporan yang kurang lengkap, tapi
 * `cleanupOrphanDataAction` yang MENGHAPUS baris `school_contacts`
 * berdasarkan set itu. Satu user yang cuma "tidak terambil" cukup untuk
 * membuat kontaknya dihapus permanen, dan penghapusannya terlihat sah: ia
 * tercatat di audit log sebagai pembersihan yang berhasil.
 *
 * ## Kenapa MELEMPAR, bukan mengembalikan apa yang terambil
 *
 * Mengembalikan hasil separuh akan mereproduksi tepat bug yang sedang
 * ditutup: pemanggil tidak punya cara membedakan "user ini tidak ada" dari
 * "user ini tidak terambil", dan keduanya berakhir pada keputusan hapus yang
 * sama. Daftar tidak lengkap lebih berbahaya daripada kegagalan yang terlihat,
 * karena kegagalan menghentikan pembersihan sedangkan daftar separuh
 * menjalankannya dengan data yang salah.
 *
 * ## Kenapa tidak memakai `data.nextPage`
 *
 * `auth-js` mengembalikan `nextPage`, tapi parsernya rusak:
 * `parseInt(link.split(';')[0].split('=')[1].substring(0, 1))` hanya mengambil
 * SATU karakter nomor halaman. Diverifikasi empiris pada `@supabase/auth-js`
 * yang terpasang: `page=10` terparse menjadi `1`. Mengikuti `nextPage` akan
 * melompat kembali ke halaman 1 begitu mencapai halaman 10 — loop tanpa akhir
 * atas data yang sama.
 *
 * ## Kenapa berhenti pada halaman KOSONG, bukan pada halaman pendek
 *
 * Cek "halaman lebih pendek dari yang diminta berarti sudah habis" terlihat
 * benar tapi punya mode gagal yang persis sama dengan bug aslinya: kalau
 * server memotong `per_page` menjadi, misalnya, 100, maka SETIAP halaman
 * lebih pendek dari 200 dan loop berhenti setelah halaman pertama. Jadi
 * satu-satunya kondisi berhenti yang aman adalah halaman kosong, dengan
 * ongkos satu permintaan tambahan di akhir.
 *
 * Dedup per id menjaga kasus ketiga: server yang mengabaikan parameter `page`
 * akan mengembalikan halaman penuh yang sama berulang kali. Halaman penuh
 * yang tidak menyumbang satu pun id baru berarti penomorannya tidak bekerja,
 * dan itu dilempar, bukan dipotong senyap.
 */
export async function listAllAuthUsers(authClient: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  const seenIds = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await authClient.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });

    if (error) {
      throw new Error(
        `Gagal mengambil daftar user auth pada halaman ${page}: ${error.message}`,
      );
    }

    const batch = data?.users ?? [];
    if (batch.length === 0) {
      return users;
    }

    let added = 0;
    for (const user of batch) {
      if (seenIds.has(user.id)) continue;
      seenIds.add(user.id);
      users.push(user);
      added++;
    }

    if (added === 0) {
      throw new Error(
        `Halaman ${page} daftar user auth mengembalikan ${batch.length} baris yang semuanya duplikat. ` +
        "Paginasi tidak bekerja, jadi daftarnya tidak bisa dijamin lengkap.",
      );
    }
  }

  throw new Error(
    `Daftar user auth melewati batas ${MAX_PAGES} halaman (${MAX_PAGES * PAGE_SIZE} user). ` +
    "Dihentikan supaya tidak mengembalikan daftar yang tidak lengkap.",
  );
}
