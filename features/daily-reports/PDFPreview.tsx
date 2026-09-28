"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Modal } from "@/components/ui/modal";

type Props = {
  src: string;
  fileName: string;
};

/**
 * Tombol yang membuka PDF di overlay.
 *
 * Pemicunya sudah `<button type="button">` sejak awal, jadi temuan #1 di sini
 * hanya menyangkut overlay-nya: `createPortal` tulisan sendiri tanpa
 * `role="dialog"`, tanpa Escape, tanpa jebakan fokus, tanpa pemulihan fokus.
 * Digantikan `Modal` bersama.
 *
 * `title={fileName}` pada pemicunya juga dibuang (temuan #14): atribut `title`
 * tidak muncul di sentuh maupun keyboard, jadi nama berkasnya tak pernah sampai
 * ke sebagian pengguna. Sekarang nama berkas masuk ke `aria-label`.
 *
 * Prop `className` dihapus — ia diterima tapi tidak pernah dipakai di dalam
 * komponen ini, jadi pemanggil yang mengirimnya akan mengira tata letaknya bisa
 * diatur padahal tidak.
 */
export function PDFPreview({ src, fileName }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition-all w-full text-xs font-semibold"
        aria-label={`Lihat PDF: ${fileName}`}
      >
        <FileText size={14} aria-hidden="true" />
        <span className="truncate">Lihat PDF</span>
      </button>

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={`Pratinjau PDF: ${fileName}`}
        hideTitle
        closeLabel="Tutup pratinjau PDF"
        panelClassName="max-w-4xl max-h-[85vh] w-full flex flex-col items-center justify-center"
        closeClassName="absolute -top-10 right-0 z-10 text-white/85 hover:text-white bg-slate-800/80 p-2 rounded-full hover:bg-slate-800 transition-all flex items-center justify-center shadow-lg"
      >
        {/*
          `<iframe>` ada di daftar `FOCUSABLE` milik `Modal`, jadi ia ikut masuk
          jebakan fokus dan justru menerima fokus awal — itu yang diinginkan:
          pengguna keyboard langsung berada di dokumen yang ingin dibacanya.
        */}
        <iframe
          src={src}
          className="w-full h-full rounded-lg shadow-2xl border border-white/10"
          title={fileName}
          style={{ minHeight: "500px" }}
        />
        <p className="text-white text-xs font-semibold mt-3 bg-slate-900/60 px-3 py-1 rounded-full border border-white/5 truncate max-w-md">
          {fileName}
        </p>
      </Modal>
    </>
  );
}
