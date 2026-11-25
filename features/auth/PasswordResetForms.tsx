"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction, resetPasswordAction } from "./password-reset-actions";

const initialState = { ok: false, message: "" };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initialState);
  return <form action={action} className="surface grid gap-4 p-5 sm:p-6">
    <label className="form-field"><span className="form-label">Email akun</span><input name="email" type="email" autoComplete="email" className="form-input" placeholder="nama@email.com" required maxLength={320} /></label>
    {state.message && <p role="status" className={state.ok ? "rounded-lg bg-teal-50 p-3 text-sm text-teal-900" : "rounded-lg bg-red-50 p-3 text-sm text-red-800"}>{state.message}</p>}
    <button className="button-primary" type="submit" disabled={pending}>{pending ? "Memproses..." : "Kirim tautan reset"}</button>
    <Link href="/login" className="text-center text-sm font-semibold text-red-700 underline-offset-4 hover:underline">Kembali ke login</Link>
  </form>;
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialState);
  if (!/^[a-f0-9]{64}$/.test(token)) return <div className="surface grid gap-4 p-5 sm:p-6"><p className="text-sm text-red-800">Tautan tidak valid. Minta tautan reset password baru.</p><Link className="button-primary" href="/forgot-password">Minta tautan baru</Link></div>;
  return <form action={action} className="surface grid gap-4 p-5 sm:p-6">
    <input type="hidden" name="token" value={token} />
    {state.message && <p role="status" className={state.ok ? "rounded-lg bg-teal-50 p-3 text-sm text-teal-900" : "rounded-lg bg-red-50 p-3 text-sm text-red-800"}>{state.message}</p>}
    {state.ok ? <Link href="/login" className="button-primary">Masuk dengan password baru</Link> : <>
      <label className="form-field"><span className="form-label">Password baru</span><input className="form-input" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><span className="text-xs text-slate-600">Minimal 12 karakter.</span></label>
      <label className="form-field"><span className="form-label">Ulangi password baru</span><input className="form-input" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
      <button type="submit" disabled={pending} className="button-primary">{pending ? "Menyimpan..." : "Simpan password baru"}</button>
    </>}
    <Link href="/forgot-password" className="text-center text-sm font-semibold text-red-700 underline-offset-4 hover:underline">Minta tautan lain</Link>
  </form>;
}
