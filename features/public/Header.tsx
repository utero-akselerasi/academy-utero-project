"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GraduationCap, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Us" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
  { href: "/faq", label: "FAQ" },
  { href: "/terms", label: "Terms" },
];

const MOBILE_MENU_ID = "mobile-nav";

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);

  // Escape menutup menu, dan fokus kembali ke tombol pemicunya. Tanpa
  // pemulihan fokus, menutup menu meninggalkan fokus di tautan yang baru saja
  // disembunyikan — dan Tab berikutnya melanjutkan dari tempat yang tak terlihat.
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        toggleRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  // Fokus masuk ke tautan pertama saat menu dibuka. Tanpa ini fokus tetap di
  // tombol hamburger dan pengguna keyboard tidak punya petunjuk bahwa ada enam
  // tautan yang baru muncul.
  useEffect(() => {
    if (!isOpen) return;
    menuRef.current?.querySelector<HTMLElement>("a")?.focus();
  }, [isOpen]);

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link className="flex items-center gap-2 font-black tracking-wider text-teal-700 hover:opacity-80 transition-all z-50" href="/">
          <GraduationCap size={24} aria-hidden="true" />
          <span className="hidden sm:inline">UTERO ACADEMY</span>
          <span className="sm:hidden">UTERO</span>
        </Link>

        {/*
          `aria-label` membedakan dua landmark navigasi yang isinya sama (temuan
          #9). Tanpa label, daftar landmark pembaca layar menampilkan dua
          "navigation" identik dan pengguna tidak bisa tahu mana yang mana —
          padahal salah satunya selalu tersembunyi.
        */}
        <nav aria-label="Navigasi utama" className="hidden md:flex items-center gap-3 text-xs font-bold text-slate-600">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              className="rounded-lg px-2.5 py-1.5 hover:bg-slate-100 transition-all hover:text-slate-900"
              href={link.href}
            >
              {link.label}
            </Link>
          ))}

          <div className="h-4 w-px bg-slate-200 mx-1" aria-hidden="true" />

          <Link className="rounded-lg px-3 py-1.5 bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 transition-all" href="/daftar">Daftar</Link>
          <Link className="rounded-lg px-3 py-1.5 bg-[#CE181E] text-white hover:bg-[#B61016] transition-all shadow-sm" href="/login">Login</Link>
        </nav>

        {/*
          `aria-expanded` + `aria-controls` (temuan #9). Sebelumnya tombol ini
          hanya punya `aria-label="Toggle Menu"`, jadi pembaca layar
          mengumumkannya dengan nama yang sama baik menunya terbuka maupun
          tertutup — pengguna menekannya tanpa cara apa pun untuk mengetahui apa
          yang terjadi.

          Labelnya ikut berubah mengikuti keadaan. "Toggle Menu" memberi tahu
          tombolnya bisa ditekan, bukan apa yang akan terjadi.
        */}
        <button
          ref={toggleRef}
          type="button"
          className="md:hidden z-50 p-2 -mr-2"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls={MOBILE_MENU_ID}
          aria-label={isOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
        >
          {isOpen ? <X size={24} className="text-slate-900" aria-hidden="true" /> : <Menu size={24} className="text-slate-900" aria-hidden="true" />}
        </button>

        {/*
          Menu mobile. `inert` saat tertutup (temuan #5).

          Sebelumnya menu ini hanya digeser keluar layar lewat `translate-x-full`
          — ia tetap terpasang dan tautannya tetap bisa difokus. Jadi di perangkat
          mobile, Tab dari header masuk ke enam tautan yang TIDAK TERLIHAT di
          layar: fokus menghilang, dan penekanan Enter membawa pengguna ke halaman
          yang tidak pernah ia lihat.

          `inert` dipilih, bukan render bersyarat: transisi `translate-x` adalah
          animasinya, dan melepas elemennya dari DOM menghapus animasi keluarnya.
          `inert` mencabut seluruh isinya dari urutan Tab, dari pointer, dan dari
          pohon aksesibilitas sekaligus — tepat yang dibutuhkan, tanpa mengubah
          tampilan.

          `aria-hidden` TIDAK dipakai bersamanya: `inert` sudah menyembunyikannya
          dari pembaca layar, dan `aria-hidden` pada elemen yang memuat elemen
          fokusabel justru kombinasi yang dilarang.
        */}
        <nav
          ref={menuRef}
          id={MOBILE_MENU_ID}
          aria-label="Navigasi mobile"
          inert={!isOpen}
          className={`fixed inset-0 bg-white/95 backdrop-blur-sm z-40 transition-transform duration-300 md:hidden flex flex-col pt-20 px-6 gap-4 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              onClick={() => setIsOpen(false)}
              className="text-xl font-bold py-3 border-b border-slate-100"
              href={link.href}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex gap-3 mt-4">
            <Link onClick={() => setIsOpen(false)} className="flex-1 text-center rounded-lg px-4 py-3 bg-teal-50 border border-teal-200 text-teal-700 font-bold" href="/daftar">Daftar</Link>
            <Link onClick={() => setIsOpen(false)} className="flex-1 text-center rounded-lg px-4 py-3 bg-[#CE181E] text-white font-bold hover:bg-[#B61016] transition-all" href="/login">Login</Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
