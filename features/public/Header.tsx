"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Menu, X } from "lucide-react";

export function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link className="flex items-center gap-2 font-black tracking-wider text-teal-700 hover:opacity-80 transition-all z-50" href="/">
          <GraduationCap size={24} />
          <span className="hidden sm:inline">UTERO ACADEMY</span>
          <span className="sm:hidden">UTERO</span>
        </Link>
        
        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-3 text-xs font-bold text-slate-600">
          <Link className="rounded-lg px-2.5 py-1.5 hover:bg-slate-100 transition-all hover:text-slate-900" href="/">Home</Link>
          <Link className="rounded-lg px-2.5 py-1.5 hover:bg-slate-100 transition-all hover:text-slate-900" href="/about">About Us</Link>
          <Link className="rounded-lg px-2.5 py-1.5 hover:bg-slate-100 transition-all hover:text-slate-900" href="/blog">Blog</Link>
          <Link className="rounded-lg px-2.5 py-1.5 hover:bg-slate-100 transition-all hover:text-slate-900" href="/contact">Contact</Link>
          <Link className="rounded-lg px-2.5 py-1.5 hover:bg-slate-100 transition-all hover:text-slate-900" href="/faq">FAQ</Link>
          <Link className="rounded-lg px-2.5 py-1.5 hover:bg-slate-100 transition-all hover:text-slate-900" href="/terms">Terms</Link>
          
          <div className="h-4 w-px bg-slate-200 mx-1" />

          <Link className="rounded-lg px-3 py-1.5 bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 transition-all" href="/daftar">Daftar</Link>
          <Link className="rounded-lg px-3 py-1.5 bg-[#CE181E] text-white hover:bg-[#B61016] transition-all shadow-sm" href="/login">Login</Link>
        </nav>

        {/* Mobile Toggle */}
        <button className="md:hidden z-50 p-2 -mr-2" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle Menu">
          {isOpen ? <X size={24} className="text-slate-900" /> : <Menu size={24} className="text-slate-900" />}
        </button>

        {/* Mobile Nav Overlay */}
        <div className={`fixed inset-0 bg-white/95 backdrop-blur-sm z-40 transition-transform duration-300 md:hidden flex flex-col pt-20 px-6 gap-4 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <Link onClick={() => setIsOpen(false)} className="text-xl font-bold py-3 border-b border-slate-100" href="/">Home</Link>
          <Link onClick={() => setIsOpen(false)} className="text-xl font-bold py-3 border-b border-slate-100" href="/about">About Us</Link>
          <Link onClick={() => setIsOpen(false)} className="text-xl font-bold py-3 border-b border-slate-100" href="/blog">Blog</Link>
          <Link onClick={() => setIsOpen(false)} className="text-xl font-bold py-3 border-b border-slate-100" href="/contact">Contact</Link>
          <Link onClick={() => setIsOpen(false)} className="text-xl font-bold py-3 border-b border-slate-100" href="/faq">FAQ</Link>
          <Link onClick={() => setIsOpen(false)} className="text-xl font-bold py-3 border-b border-slate-100" href="/terms">Terms</Link>
          <div className="flex gap-3 mt-4">
            <Link onClick={() => setIsOpen(false)} className="flex-1 text-center rounded-lg px-4 py-3 bg-teal-50 border border-teal-200 text-teal-700 font-bold" href="/daftar">Daftar</Link>
            <Link onClick={() => setIsOpen(false)} className="flex-1 text-center rounded-lg px-4 py-3 bg-[#CE181E] text-white font-bold hover:bg-[#B61016] transition-all" href="/login">Login</Link>
          </div>
        </div>
      </div>
    </header>
  );
}

