"use client";

import { useEffect } from "react";

/**
 * Buka dialog cetak begitu halaman siap.
 *
 * Dulu perilaku ini ditulis sebagai <script dangerouslySetInnerHTML> di halaman
 * cetak sertifikat dan laporan. Isinya statis dan tidak berbahaya, tapi satu
 * saja inline script di aplikasi memaksa Content-Security-Policy melonggarkan
 * script-src ('unsafe-inline' atau daftar hash yang harus dijaga manual) -
 * pelonggaran yang berlaku untuk seluruh halaman, termasuk halaman yang merender
 * konten tulisan staf. Dipindah ke komponen client supaya CSP bisa ketat.
 */
export function AutoPrint() {
  useEffect(() => {
    window.print();
  }, []);

  return null;
}
