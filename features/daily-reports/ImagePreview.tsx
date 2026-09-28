"use client";

import { useState } from "react";
import { ZoomIn } from "lucide-react";
import { Modal } from "@/components/ui/modal";

type Props = {
  src: string;
  alt: string;
  className?: string;
};

/**
 * Gambar kecil yang bisa dibuka besar. Dipakai di 16 tempat.
 *
 * Dua temuan aksesibilitas diperbaiki di sini:
 *
 * **#1a — pemicunya tidak bisa dipakai keyboard.** Sebelumnya pemicunya
 * `<div onClick>`. Div tidak bisa difokus dan tidak menanggapi Enter/Space, jadi
 * pengguna keyboard maupun pembaca layar TIDAK PUNYA CARA APA PUN membuka
 * pratinjaunya — dan untuk selfie absensi serta lampiran laporan, gambar itulah
 * buktinya. Sekarang `<button type="button">`, yang mendapatkan fokus, Enter,
 * Space, dan pengumuman sebagai kontrol secara gratis.
 *
 * **#1b — lightbox-nya bukan dialog.** Overlay lamanya `createPortal` tulisan
 * sendiri tanpa `role="dialog"`, tanpa Escape, tanpa jebakan fokus, dan tanpa
 * pemulihan fokus. Digantikan `Modal` bersama, jadi perilakunya tidak bisa lagi
 * menyimpang dari sepuluh overlay lain.
 */
export function ImagePreview({ src, alt, className = "max-h-28 w-auto object-contain mx-auto" }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/*
        `stopPropagation` dipertahankan: beberapa pemanggil menaruh pratinjau ini
        di dalam kartu yang juga bisa diklik, dan tanpa ini satu klik memicu
        keduanya.

        `e.preventDefault()` tidak lagi diperlukan — `type="button"` sudah
        mencegah submit form.
      */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        aria-label={`Perbesar gambar: ${alt}`}
        className="relative group block w-full cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-1 transition-all hover:border-teal-500 hover:shadow-sm"
      >
        <img src={src} alt={alt} className={className} />
        <span
          className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg"
          aria-hidden="true"
        >
          <span className="bg-white/90 text-slate-800 p-1.5 rounded-full shadow-sm">
            <ZoomIn size={14} className="text-teal-700 font-bold" />
          </span>
        </span>
      </button>

      {/*
        `hideTitle`: desain pratinjau ini tidak punya bilah judul — keterangannya
        tercetak di bawah gambar. Judulnya tetap ada untuk `aria-labelledby`,
        cuma disembunyikan secara visual, jadi pembaca layar tetap mengumumkan
        gambar apa yang sedang dibuka.

        `panelClassName` menghapus latar putih dan padding default: panelnya di
        sini adalah gambar itu sendiri di atas latar gelap.
      */}
      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={`Pratinjau gambar: ${alt}`}
        hideTitle
        closeLabel="Tutup pratinjau gambar"
        panelClassName="max-w-3xl max-h-[85vh] w-full flex flex-col items-center justify-center"
        closeClassName="absolute -top-10 right-0 z-10 text-white/85 hover:text-white bg-slate-800/80 p-2 rounded-full hover:bg-slate-800 transition-all flex items-center justify-center shadow-lg"
      >
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border border-white/10 bg-black/40"
        />
        <p className="text-white text-xs font-semibold mt-3 bg-slate-900/60 px-3 py-1 rounded-full border border-white/5 truncate max-w-md">
          {alt}
        </p>
      </Modal>
    </>
  );
}
