"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupApplicantAction } from "./signup-action";

export function ApplicantSignupForm() {
  const [state, formAction, pending] = useActionState(signupApplicantAction, { ok: false, message: "" });
  return (
    <form action={formAction} className="surface grid gap-4 p-6">
      {state.message && <p role="status" className={state.ok ? "text-teal-700" : "text-red-700"}>{state.message}</p>}
      <label className="form-field"><span className="form-label">Nama lengkap</span><input className="form-input" name="fullName" required minLength={3} maxLength={150} autoComplete="name" /></label>
      <label className="form-field"><span className="form-label">Email</span><input className="form-input" name="email" type="email" required autoComplete="email" /></label>
      <label className="form-field"><span className="form-label">Password (minimal 12 karakter)</span><input className="form-input" name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
      <label className="form-field"><span className="form-label">Ulangi password</span><input className="form-input" name="confirmPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
      <button className="button-primary" disabled={pending} type="submit">{pending ? "Membuat akun..." : "Buat akun pelamar"}</button>
      <p className="text-sm">Sudah punya akun? <Link href="/login" className="text-teal-700 underline">Login</Link></p>
    </form>
  );
}
