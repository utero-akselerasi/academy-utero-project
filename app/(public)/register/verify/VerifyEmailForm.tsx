"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { resendVerificationAction, verifyEmailAction } from "@/features/registration/verify-email-action";

export function VerifyEmailForm({ token }: { token: string }) {
  const [verifyState, verifyAction, verifying] = useActionState(verifyEmailAction, { ok: false, message: "" });
  const [resendState, resendAction, resending] = useActionState(resendVerificationAction, { ok: false, message: "" });
  const verifyForm = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (!token || submitted.current) return;
    submitted.current = true;
    verifyForm.current?.requestSubmit();
  }, [token]);

  return <div className="grid gap-6">
    <form ref={verifyForm} action={verifyAction} className="hidden">
      <input type="hidden" name="token" value={token} />
    </form>
    <section className="surface grid gap-4 p-6" aria-live="polite">
      {token && !verifyState.message
        ? <p>{verifying ? "Sedang memverifikasi email dan menyiapkan dashboard..." : "Menyiapkan verifikasi email..."}</p>
        : <p role={verifyState.message ? "alert" : undefined}>{verifyState.message || "Tautan verifikasi tidak ditemukan."}</p>}
    </section>
    {(!token || verifyState.message) && <form action={resendAction} className="surface grid gap-4 p-6">
      <p>Sudah terverifikasi? <Link className="text-teal-700 underline" href="/login">Masuk ke akun</Link></p>
      <label className="form-field"><span className="form-label">Kirim ulang ke email</span><input className="form-input" name="email" type="email" required autoComplete="email" /></label>
      {resendState.message && <p role="status" className={resendState.ok ? "text-teal-700" : "text-red-700"}>{resendState.message}</p>}
      <button className="button-primary" type="submit" disabled={resending}>{resending ? "Mengirim..." : "Kirim ulang verifikasi"}</button>
    </form>}
  </div>;
}
