import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Konfigurasi test.
 *
 * Kenapa vitest, bukan `node --test` yang sudah ada di Node 24: Node 24 memang
 * menjalankan TypeScript langsung, tapi dua hal membuatnya tidak cukup di repo
 * ini. Pertama, ia tidak mengenal alias `@/` dari `tsconfig.json` — mengimpor
 * `features/auth/roles.ts` langsung gagal dengan `ERR_MODULE_NOT_FOUND` di
 * `@/lib/supabase/server`. Kedua, dan ini yang menentukan: menguji guard
 * otorisasi mustahil tanpa peniruan modul, karena `requireRole` memanggil
 * `redirect()` milik Next (yang melempar) dan klien Supabase (yang butuh
 * jaringan). `node:test` tidak punya peniru modul; `vi.mock` punya.
 *
 * Tidak memakai plugin React/jsdom sama sekali. Test di batch ini menguji
 * **otorisasi**, bukan render — dan lingkungan `node` membuatnya jalan dalam
 * hitungan ratusan milidetik, yang menentukan apakah orang benar-benar
 * menjalankannya sebelum commit.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Satu berkas test membaca seluruh pohon `app/` dari disk. Reporter default
    // sudah cukup; tak ada yang perlu disetel di luar ini.
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
