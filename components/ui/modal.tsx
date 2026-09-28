"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Satu dialog modal yang bisa dipakai keyboard, dipakai bersama seluruh aplikasi.
 *
 * Audit aksesibilitas menemukan **sebelas** overlay yang ditulis terpisah
 * (`ImagePreview`, `PDFPreview`, `AssessmentModal`, enam di `UserRoleManager`,
 * `CmsManager`, dua di `MentorReportsManager`, satu di halaman absensi admin), dan
 * tidak satu pun punya `role="dialog"`, penutupan dengan Escape, jebakan fokus,
 * maupun pemulihan fokus. Memperbaikinya sebelas kali berarti sebelas kesempatan
 * untuk melewatkan satu bagian — jadi perilakunya duduk di sini.
 *
 * Yang ditangani komponen ini, dan alasannya:
 *
 * - `role="dialog"` + `aria-modal="true"` + `aria-labelledby` — tanpa ketiganya
 *   pembaca layar tidak mengumumkan apa pun saat overlay muncul: isinya sekadar
 *   teks tambahan di tengah halaman.
 * - **Escape menutup.** Satu-satunya jalan keluar sebelumnya adalah mengklik
 *   tombol X atau latar, keduanya butuh tetikus.
 * - **Jebakan fokus.** Tanpa ini Tab berjalan keluar ke halaman di belakang
 *   overlay yang tidak bisa dilihat penggunanya — fokus menghilang ke tempat yang
 *   tak terlihat.
 * - **Fokus dipulihkan ke pemicu** saat ditutup. Tanpa ini fokus kembali ke awal
 *   dokumen dan pengguna keyboard harus menelusuri ulang seluruh halaman.
 * - **`aria-label` pada tombol tutup** (temuan #13). Tombol beris ikon `X` tanpa
 *   nama terbaca sebagai "button" saja.
 * - **Scroll latar dikunci** selagi dialog terbuka.
 */

/**
 * Elemen yang bisa menerima fokus di dalam dialog.
 *
 * `:not([disabled])` dan `tabindex="-1"` dikecualikan: keduanya ada di DOM tapi
 * tidak bisa difokus, dan memasukkannya ke daftar jebakan berarti Tab bisa
 * berhenti di tempat yang tak menerima fokus — jebakan yang bocor.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  /** Judul dialog. Diumumkan pembaca layar lewat `aria-labelledby`. */
  title: string;
  /**
   * Sembunyikan judul secara visual tapi tetap sediakan untuk pembaca layar.
   * Dipakai overlay pratinjau gambar/PDF yang desainnya tidak punya bilah judul.
   */
  hideTitle?: boolean;
  /** Label tombol tutup. Default "Tutup"; sebutkan objeknya kalau bisa. */
  closeLabel?: string;
  /** Kelas untuk panel dialog, bukan untuk latarnya. */
  panelClassName?: string;
  /**
   * Kelas untuk tombol tutup. Default-nya dirancang untuk panel putih; overlay
   * pratinjau yang panelnya transparan di atas latar gelap butuh yang terang.
   */
  closeClassName?: string;
  /**
   * Kelas untuk baris judul + tombol tutup.
   *
   * Default-nya sebuah baris biasa di atas isi dialog. Pemanggil yang sudah punya
   * bilah judul sendiri dalam desainnya menaruhnya absolut (`absolute top-0
   * right-0 ...`) supaya baris ini tidak menambah bilah kedua — judulnya tetap
   * ada di DOM untuk `aria-labelledby`, cuma tidak lagi memakan ruang.
   */
  headerClassName?: string;
  children: React.ReactNode;
};

export function Modal({
  open,
  onClose,
  title,
  hideTitle = false,
  closeLabel = "Tutup",
  panelClassName = "surface w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6",
  closeClassName = "shrink-0 rounded-full p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900",
  headerClassName = "flex items-start justify-between gap-4",
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  /**
   * Elemen yang memegang fokus sebelum dialog dibuka, supaya bisa dipulihkan.
   *
   * Disimpan di ref, bukan state: menyimpannya di state akan memicu render dan
   * ref-nya harus dibaca di cleanup effect, di mana nilai state sudah basi.
   */
  const triggerRef = useRef<HTMLElement | null>(null);

  // `onClose` disimpan di ref supaya effect di bawah tidak perlu memasang ulang
  // listener setiap kali pemanggil merender fungsi baru — pemanggil yang menulis
  // `onClose={() => setOpen(false)}` (semuanya begitu) membuat identitas baru di
  // setiap render, dan pemasangan ulang listener di tengah interaksi bisa
  // kehilangan penekanan tombol.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const focusables = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return [] as HTMLElement[];
    return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
  }, []);

  useEffect(() => {
    if (!open) return;

    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Fokus awal masuk ke elemen pertama yang bisa difokus; kalau tidak ada,
    // ke panelnya (yang punya `tabIndex={-1}`). Tanpa langkah ini fokus tetap
    // di pemicu yang sekarang tertutup overlay, dan Tab pertama pengguna
    // berjalan di halaman di belakangnya.
    const first = focusables()[0];
    (first ?? panelRef.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) {
        // Tidak ada yang bisa difokus di dalam: tahan fokus di panel, jangan
        // biarkan Tab keluar ke halaman yang tak terlihat.
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;

      // Fokus melingkar. Pemeriksaan `!panel.contains(active)` menangani kasus
      // fokus sudah di luar (misalnya elemen yang memegangnya baru dilepas):
      // tanpa itu, Tab tidak pernah kembali ke dalam dialog.
      if (event.shiftKey) {
        if (active === firstItem || !panelRef.current?.contains(active)) {
          event.preventDefault();
          lastItem.focus();
        }
      } else if (active === lastItem || !panelRef.current?.contains(active)) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    // `capture` supaya Escape ditangani sebelum handler lain di halaman bisa
    // menelannya.
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [open, focusables]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      // Latar menutup saat diklik, tapi TIDAK diberi peran tombol: ia bukan
      // kontrol, dan Escape sudah menyediakan jalan keluar lewat keyboard.
      // Memberinya peran justru menambah satu titik Tab tanpa nama.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative outline-none ${panelClassName}`}
      >
        <div className={headerClassName}>
          <h2
            id={titleId}
            className={hideTitle ? "sr-only" : "text-lg font-bold text-slate-950"}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className={closeClassName}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {children}
      </div>
    </div>,
    document.body,
  );
}
