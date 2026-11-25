"use client";

import { useSyncExternalStore } from "react";
import { ResetPasswordForm } from "@/features/auth/PasswordResetForms";

function subscribeToResetToken(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function getResetToken() {
  return window.location.hash.slice(1) || "missing";
}

export default function ResetPasswordPage() {
  const token = useSyncExternalStore(subscribeToResetToken, getResetToken, () => "");
  return <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-md content-center gap-5 px-4 py-12">
    <header><p className="text-sm font-bold uppercase text-teal-700">Pemulihan akun</p><h1 className="mt-2 text-2xl font-bold text-slate-950">Buat password baru</h1><p className="mt-2 text-sm leading-6 text-slate-600">Tautan hanya berlaku satu jam dan sekali pakai.</p></header>
    {!token ? <section className="surface p-5 text-sm text-slate-600" role="status">Memeriksa tautan reset...</section> : <ResetPasswordForm token={token} />}
  </main>;
}
