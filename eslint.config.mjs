import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Flat config (`eslint.config.mjs`), bukan `.eslintrc`.
 *
 * `next lint` **sudah dihapus** di Next.js 16 — tidak ada `next-lint.js` di
 * `node_modules/next/dist/cli/`. Jadi eslint dipanggil langsung lewat script
 * `lint`, dan konfigurasinya wajib flat config.
 *
 * Tanpa `FlatCompat`: `eslint-config-next@16` sudah mengekspor **array flat
 * config asli** (lihat `dist/core-web-vitals.js`), jadi jembatan
 * `@eslint/eslintrc` hanya akan menambah satu dependensi tanpa guna.
 *
 * **eslint dipin ke 9, bukan 10.** Ini bukan kelalaian: `eslint-plugin-react`
 * yang dibundel `eslint-config-next@16.3.6` belum mendukung eslint 10 —
 * dicoba dan hasilnya `TypeError: contextOrFilename.getFilename is not a
 * function` saat memuat rule `react/display-name`, yaitu lint **gagal jalan
 * sama sekali**, bukan sekadar peringatan peer dependency. Naikkan ke 10 hanya
 * setelah `eslint-config-next` menaikkan plugin-nya.
 */

/**
 * Dua tingkat keparahan, dan pembagiannya disengaja.
 *
 * Basis `eslint-config-next` sendiri sudah menghasilkan **157 error** di repo
 * ini pada hari pertama. Gate CI yang merah sejak commit pertama tidak
 * menghasilkan kode yang lebih baik — ia menghasilkan gate yang dimatikan orang.
 * Jadi:
 *
 * - **error** hanya untuk aturan yang menyangkut keamanan atau kebenaran, dan
 *   `--max-warnings` dibiarkan longgar. Ini yang menggagalkan CI.
 * - **warn** untuk sisanya: tetap terlihat di output, tidak memblokir, dan
 *   jumlahnya bisa diturunkan bertahap.
 *
 * Yang TIDAK dilakukan: menonaktifkan aturan. Aturan yang di-`off` hilang dari
 * pandangan; yang di-`warn` masih terhitung dan bisa diangkat jadi error begitu
 * hitungannya nol.
 */
export default [
  {
    // Berkas hasil build atau milik alat lain. `.next/` berisi puluhan ribu
    // berkas, jadi tanpa daftar ini lint berjalan sangat lama lalu penuh temuan
    // yang bukan kode kita.
    ignores: [
      ".next/**",
      ".next-*/**",
      "out/**",
      "node_modules/**",
      "next-env.d.ts",
      ".codegraph/**",
    ],
  },

  ...nextCoreWebVitals,
  ...nextTypescript,

  {
    rules: {
      // ---------------------------------------------------------------------
      // ERROR — menggagalkan CI
      // ---------------------------------------------------------------------

      /**
       * `react-hooks/*` adalah **kebenaran**, bukan gaya. Dependency array yang
       * salah menghasilkan data basi yang terlihat seperti data benar; di
       * dashboard yang menampilkan absensi dan laporan per-peserta, itu berarti
       * menampilkan data peserta yang salah tanpa error apa pun.
       */
      "react-hooks/rules-of-hooks": "error",

      /**
       * `<a target="_blank">` tanpa `rel="noreferrer"` memberi halaman tujuan
       * akses `window.opener` ke halaman kita — tabnabbing. Ini satu-satunya
       * aturan bawaan Next yang benar-benar soal keamanan, jadi ia error.
       */
      "react/jsx-no-target-blank": "error",

      // ---------------------------------------------------------------------
      // WARN — terlihat, tidak memblokir, diturunkan bertahap
      // ---------------------------------------------------------------------

      /**
       * 108 kemunculan. `any` mematikan pengecekan tipe tepat di tempat data
       * luar masuk, dan repo ini **tidak punya test framework sama sekali** —
       * `tsc` adalah satu-satunya jaring verifikasi yang ada, jadi setiap `any`
       * melubanginya. Layak dibereskan, tapi 108 perubahan tipe tidak boleh
       * menumpang di commit keamanan; diffnya akan menenggelamkan yang penting.
       */
      "@typescript-eslint/no-explicit-any": "warn",

      /**
       * 89 kemunculan. Sering merupakan sisa refactor setengah jalan — mis.
       * hasil kueri yang tak lagi dipakai padahal kuerinya masih jalan. Awalan
       * `_` dikecualikan: itu cara menandai parameter yang sengaja diabaikan.
       */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      /**
       * 7 kemunculan. `setState` langsung di dalam effect memicu render kedua
       * dan bisa menimpa input pengguna. Bug nyata, tapi perbaikannya mengubah
       * perilaku komponen sehingga butuh pengujian manual per komponen.
       */
      "react-hooks/set-state-in-effect": "warn",

      /**
       * 30 kemunculan, seluruhnya teks copy (apostrof di kalimat Indonesia dan
       * Inggris). Murni kosmetik.
       */
      "react/no-unescaped-entities": "warn",

      /**
       * 20 kemunculan. Saran memakai `next/image`. **Sengaja tidak dipatuhi
       * sekarang**: repo ini nol memakai `next/image`, dan itu keputusan yang
       * mendukung keamanan — `remotePatterns` di `next.config.ts` salah di tiga
       * hal, dan Image Optimization API punya riwayat RCE (GHSA-2xp9-vwfh-vxw4,
       * yang justru tak terjangkau di sini karena API-nya tak dipakai).
       * Mengaktifkan `next/image` akan membuka permukaan itu.
       */
      "@next/next/no-img-element": "warn",
    },
  },
];
