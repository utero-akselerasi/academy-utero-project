import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Header } from "@/features/public/Header";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/*
        Tautan lompat ke konten utama (temuan aksesibilitas #16). Setiap halaman
        publik mengulang seluruh navigasi header, jadi tanpa ini pengguna keyboard
        harus menelusuri ulang setiap tautan navigasi di setiap halaman sebelum
        mencapai isinya.

        Elemen PERTAMA di dalam layout, bukan di dalam `Header`: ia harus jadi
        target Tab pertama, dan di dalam header ia akan berada setelah logo.

        Sasarannya `id` di pembungkus layout ini, bukan `<main>` masing-masing
        halaman — kesembilan halaman publik punya `<main>` sendiri, jadi id di
        sini adalah satu-satunya sasaran yang pasti ada di semuanya.

        `tabIndex={-1}` pada sasaran WAJIB: pembungkus `div` tidak bisa difokus
        secara alami, dan meloncat ke elemen yang tak bisa difokus hanya
        menggulirkan halaman — fokus keyboard tetap tertinggal di header, jadi
        Tab berikutnya kembali ke navigasi dan tautannya tidak melakukan apa pun
        yang berguna.
      */}
      <a href="#main-content" className="skip-link">
        Lewati ke konten utama
      </a>
      <Header />
      <div id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </div>
      <footer className="bg-slate-900 text-slate-400 py-10 border-t border-slate-800 text-xs shrink-0">
        <div className="max-w-6xl mx-auto px-6 grid gap-6 md:grid-cols-3">
          <div>
            <h4 className="text-white font-extrabold text-sm mb-3">UTERO ACADEMY</h4>
            <p className="leading-relaxed">
              Platform edukasi terpadu untuk pendidikan, magang, dan sertifikasi.
            </p>
          </div>
          <div>
            <h4 className="text-white font-extrabold text-sm mb-3">Navigasi Cepat</h4>
            <ul className="space-y-1.5">
              <li><Link href="/about" className="hover:text-white transition-all">About Us</Link></li>
              <li><Link href="/blog" className="hover:text-white transition-all">Blog / Artikel</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-all">Hubungi Kami</Link></li>
              <li><Link href="/faq" className="hover:text-white transition-all">Tanya Jawab (FAQ)</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-all">Syarat & Ketentuan</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-extrabold text-sm mb-3">Kontak Hubung</h4>
            <div className="leading-relaxed text-slate-400 text-xs"><div className="mb-1">Jl. Bantaran 1 No. 25 Malang</div><div className="mb-1">Email: uteroacademy@gmail.com</div><div>Phone: +62 895 1789 8767</div></div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 border-t border-slate-800 mt-8 pt-4 text-center">
          <p>© {new Date().getFullYear()} Utero Academy. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}



