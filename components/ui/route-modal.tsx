"use client";

import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";

/**
 * `Modal` untuk dialog yang dikendalikan **URL**, bukan state React.
 *
 * Beberapa dialog di aplikasi ini dibuka dengan menambah query param
 * (`?detailInternId=...`) dan ditutup dengan kembali ke URL dasarnya. Halaman
 * yang merendernya adalah server component, jadi ia tidak bisa menyerahkan
 * `onClose` — closure tidak bisa melintasi batas server/klien.
 *
 * Pembungkus tipis ini menyediakan `onClose` di sisi klien: ia menavigasi ke
 * `closeHref`. Dengan begitu Escape dan klik latar — dua jalan keluar yang
 * ditambahkan `Modal` — melakukan hal yang **persis sama** dengan tombol
 * "Tutup" yang sudah ada di desain, bukan sekadar menyembunyikan panel selagi
 * URL-nya masih menunjuk ke dialog yang terbuka.
 *
 * `open` tidak diekspos: halaman induk sudah memutuskan apakah dialognya ada
 * dengan merender atau tidak merender komponen ini. Menambah `open` berarti dua
 * sumber kebenaran untuk satu keadaan.
 */
type RouteModalProps = {
  /** URL yang dituju saat dialog ditutup. */
  closeHref: string;
  title: string;
  hideTitle?: boolean;
  closeLabel?: string;
  panelClassName?: string;
  closeClassName?: string;
  headerClassName?: string;
  children: React.ReactNode;
};

export function RouteModal({ closeHref, children, ...rest }: RouteModalProps) {
  const router = useRouter();

  return (
    <Modal open onClose={() => router.push(closeHref)} {...rest}>
      {children}
    </Modal>
  );
}
