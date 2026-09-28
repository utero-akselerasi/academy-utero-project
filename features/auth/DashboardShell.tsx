"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu, X, LogOut, User, Settings, ChevronDown,
  LayoutDashboard, Users, FileSpreadsheet, UserCheck,
  Kanban, Clock, FileText, CheckSquare, GraduationCap, Award, Globe, LayoutTemplate,
  BookOpen
} from "lucide-react";

/**
 * Ikon sidebar yang tersedia.
 *
 * `BookOpen` hilang dari peta ini (M-7), padahal tiga menu memakainya:
 * "LMS Penilaian" untuk super_admin dan admin, dan "LMS Pembelajaran" untuk
 * peserta. Fallback `|| LayoutDashboard` di bawah membuat ketiganya merender
 * ikon dashboard — jadi sidebar menampilkan dua item dengan ikon identik dan
 * tidak ada satu pun error, log, maupun peringatan build.
 */
const iconMap = {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  UserCheck,
  Kanban,
  Clock,
  FileText,
  CheckSquare,
  GraduationCap,
  Award,
  Globe,
  LayoutTemplate,
  BookOpen,
} satisfies Record<string, React.ComponentType<{ size?: number; className?: string }>>;

/**
 * Nama ikon yang sah, diturunkan dari `iconMap` itu sendiri.
 *
 * Sebelumnya `icon` bertipe `string`, jadi nama ikon yang tidak ada di peta
 * lolos kompilasi dan gagal secara SENYAP saat render lewat fallback di bawah.
 * Itu persis yang terjadi pada `BookOpen`. Dengan tipe ini, nama yang tak ada
 * di peta menjadi error `tsc` di `sidebarItemsMap` — bukan ikon yang salah di
 * layar yang harus ada orang yang menyadarinya.
 */
export type NavIconName = keyof typeof iconMap;

/**
 * Id tetap untuk `aria-controls` pada tombol hamburger.
 *
 * Konstanta, bukan `useId()`: `aria-controls` harus menunjuk elemen yang sama
 * dan hanya ada SATU shell per halaman, jadi id tetap lebih mudah diverifikasi
 * daripada id yang dihasilkan tiap render.
 */
const SIDEBAR_ID = "dashboard-sidebar";

/** Id tetap untuk `aria-controls` pada tombol menu akun. Alasan sama. */
const PROFILE_MENU_ID = "dashboard-profile-menu";

type NavItem = {
  label: string;
  href: string;
  icon: NavIconName;
};

type Props = {
  userName: string;
  userEmail: string;
  avatarUrl: string | null;
  roleLabel: string;
  navItems: NavItem[];
  logoutAction: () => void;
  children: React.ReactNode;
};

export function DashboardShell({ 
  userName, 
  userEmail, 
  avatarUrl, 
  roleLabel, 
  navItems, 
  logoutAction, 
  children 
}: Props) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const sidebarToggleRef = useRef<HTMLButtonElement>(null);
  const profileToggleRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  /**
   * Escape menutup sidebar mobile dan menu profil, lalu memulihkan fokus ke
   * tombol pemicunya masing-masing (temuan #8).
   *
   * Sebelumnya keduanya hanya bisa ditutup dengan mengklik latar tak terlihat —
   * satu-satunya jalan keluar butuh tetikus. Pengguna keyboard yang membuka menu
   * profil terkurung: Tab berjalan ke halaman di belakangnya dan menunya tetap
   * terbuka di layar.
   *
   * Satu listener untuk keduanya, dengan sidebar diprioritaskan karena ia yang
   * menutupi layar penuh.
   */
  useEffect(() => {
    if (!sidebarOpen && !profileOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (sidebarOpen) {
        setSidebarOpen(false);
        sidebarToggleRef.current?.focus();
        return;
      }
      setProfileOpen(false);
      profileToggleRef.current?.focus();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen, profileOpen]);

  /**
   * Menu profil ditutup saat fokus berpindah keluar darinya.
   *
   * Latar tak terlihat di `:190` hanya menangkap klik. Tanpa penanganan fokus,
   * pengguna keyboard yang Tab keluar dari menu meninggalkan menu itu terbuka
   * menutupi konten di bawahnya, tanpa cara menutupnya selain tetikus.
   *
   * `focusin` di `document`, bukan `blur` pada menunya: `blur` menyala di antara
   * dua elemen DI DALAM menu juga, jadi menunya akan tertutup begitu fokus
   * berpindah dari satu itemnya ke item berikutnya.
   */
  useEffect(() => {
    if (!profileOpen) return;

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (profileMenuRef.current?.contains(target)) return;
      if (profileToggleRef.current?.contains(target)) return;
      setProfileOpen(false);
    };

    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [profileOpen]);

  return (
    <div className="h-screen flex bg-slate-50 text-slate-900">
      {/*
        Latar gelap sidebar mobile. Tetap `onClick` saja dan TIDAK diberi peran
        tombol (temuan #8): ia bukan kontrol, dan Escape sekarang menyediakan
        jalan keluar lewat keyboard. Memberinya `role="button"` + `tabIndex`
        justru menambah satu titik Tab tanpa nama yang membingungkan.

        `aria-hidden` supaya pembaca layar tidak mengumumkan div kosong ini.
      */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/*
        `sidebar-dark` mengaktifkan cincin fokus putih dari `globals.css`. Cincin
        `--primary` (merah) di atas `slate-900` kontrasnya tidak cukup untuk jadi
        penanda fokus yang terlihat.
      */}
      <aside id={SIDEBAR_ID} className={`sidebar-dark fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 text-white transition-transform duration-300 lg:static lg:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        {/* Branding header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-800 bg-slate-950">
          <Link href="/" className="flex items-center gap-2 font-black tracking-wider text-teal-400">
            <GraduationCap size={24} aria-hidden="true" />
            <span>UTERO ACADEMY</span>
          </Link>
          {/*
            `aria-label` (temuan #8/#13): tombol ini hanya berisi ikon `X`, jadi
            pembaca layar mengumumkannya sebagai "button" tanpa keterangan apa pun
            soal apa yang akan terjadi.
          */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
            aria-label="Tutup menu samping"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/*
          `aria-label` pada `<nav>` (temuan #8). Tanpa label, daftar landmark
          pembaca layar hanya menampilkan "navigation" — tak ada petunjuk bahwa
          inilah navigasi utama dashboard.
        */}
        <nav aria-label="Navigasi dashboard" className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
          {navItems.map((item) => {
            // Fallback `|| LayoutDashboard` DIHAPUS. Justru fallback itulah yang
            // menyembunyikan M-7 selama ini: ikon yang tidak ada di peta tampil
            // sebagai ikon dashboard, jadi kesalahannya tidak pernah terlihat
            // sebagai kesalahan. Sekarang `item.icon` bertipe `NavIconName`,
            // sehingga nama yang salah tertangkap `tsc` dan pencarian ini tidak
            // bisa mengembalikan undefined.
            const IconComponent = iconMap[item.icon];
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                // Status aktif sebelumnya hanya disampaikan lewat warna latar.
                // `aria-current` membuatnya tersedia untuk pembaca layar juga.
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-bold transition-all ${
                  isActive
                    ? "bg-teal-600 text-white shadow-md shadow-teal-600/10"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <IconComponent size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Quick User summary in Sidebar bottom */}
        <div className="border-t border-slate-800 p-4 bg-slate-950/40 flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-full bg-slate-800 border border-slate-700">
            {/*
              `alt=""` menjadikannya dekoratif. Nama pengguna sudah tercetak di
              sebelahnya, jadi `alt="Avatar"` membuat pembaca layar mengumumkan
              hal yang sama dua kali.
            */}
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-teal-800 text-teal-200 font-bold" aria-hidden="true">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{userName}</p>
            <p className="text-xs text-slate-400 truncate">{roleLabel}</p>
          </div>
        </div>
      </aside>

      {/* Main Body */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
          {/*
            `focus:outline-none` dibuang (temuan #7). Aturan `:focus-visible`
            global di `globals.css` sebenarnya sudah mengalahkannya — CSS tanpa
            layer menang atas utilitas Tailwind yang ber-layer — tapi kelas itu
            tetap dihapus supaya niatnya tidak menyesatkan pembaca berikutnya.

            `aria-expanded` + `aria-controls` menghubungkan tombol ini ke sidebar
            yang dikendalikannya (temuan #8).
          */}
          <button
            ref={sidebarToggleRef}
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Buka menu samping"
            aria-expanded={sidebarOpen}
            aria-controls={SIDEBAR_ID}
          >
            <Menu size={20} aria-hidden="true" />
          </button>

          {/* Breadcrumb title placeholder */}
          <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 font-semibold">
            <span>Utero Academy Platform</span>
            <span>/</span>
            <span className="text-teal-700 font-bold">{roleLabel} Panel</span>
          </div>

          {/* User Settings Dropdown */}
          <div className="relative">
            {/*
              `aria-expanded` + `aria-controls` (temuan #8). Sebelumnya tombol ini
              tidak menyatakan apa pun: pembaca layar mengumumkan nama pengguna
              dan tidak ada petunjuk bahwa menekannya membuka sesuatu, maupun
              apakah yang dibuka itu sedang terbuka.

              `aria-haspopup` SENGAJA tidak dipakai. Audit menyebutnya, tapi
              nilainya (`menu`, dan `true` yang artinya sama) menjanjikan semantik
              menu WAI-ARIA: `role="menu"`, `role="menuitem"`, dan navigasi tombol
              panah. Isi popup ini adalah satu tautan biasa dan satu form logout —
              Tab, bukan panah. Menyatakan `haspopup` tanpa menyediakan perilaku
              itu justru menyesatkan pengguna pembaca layar ke pola interaksi yang
              tidak ada. `aria-expanded` sudah menyampaikan yang sebenarnya benar.

              `focus:outline-none` dibuang di sini juga (temuan #7).
            */}
            <button
              ref={profileToggleRef}
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 rounded-full p-1.5 hover:bg-slate-100 transition-all"
              aria-expanded={profileOpen}
              aria-controls={PROFILE_MENU_ID}
              aria-label={`Menu akun ${userName}`}
            >
              <div className="relative h-8 w-8 overflow-hidden rounded-full bg-slate-100 border border-slate-200">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-teal-50 text-teal-700 font-bold" aria-hidden="true">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="hidden sm:inline text-sm font-bold text-slate-700">{userName}</span>
              <ChevronDown size={14} className="text-slate-500" aria-hidden="true" />
            </button>

            {profileOpen && (
              <>
                {/*
                  Latar penangkap klik. `aria-hidden` supaya tidak diumumkan; ia
                  memang hanya untuk tetikus, dan jalan keluar keyboard-nya
                  sekarang ada dua: Escape, dan Tab keluar dari menu.
                */}
                <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} aria-hidden="true" />
                <div
                  ref={profileMenuRef}
                  id={PROFILE_MENU_ID}
                  className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-40 animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  <div className="px-3 py-2 border-b border-slate-100 text-left mb-1">
                    <p className="text-xs text-slate-400 font-semibold">Login sebagai</p>
                    <p className="text-sm font-black text-slate-800 truncate">{userName}</p>
                  </div>
                  <Link 
                    href="/dashboard/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700 font-bold transition-all"
                  >
                    <User size={16} />
                    <span>Edit Profil</span>
                  </Link>
                  <form action={logoutAction}>
                    <button 
                      type="submit"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 font-bold transition-all"
                    >
                      <LogOut size={16} />
                      <span>Log Out</span>
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Dashboard Main Content area */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {children}
        </div>
      </div>
    </div>
  );
}
