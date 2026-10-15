"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resendVerificationAction, verifyEmailAction } from "@/features/registration/verify-email-action";

export function VerifyEmailForm({ token }: { token: string }) {
  const [verifyState, verifyAction, verifying] = useActionState(verifyEmailAction, { ok: false, message: "" });
  const [resendState, resendAction, resending] = useActionState(resendVerificationAction, { ok: false, message: "" });
  return <div className="grid gap-6">
    <form action={verifyAction} className="surface grid gap-4 p-6">
      <input type="hidden" name="token" value={token} />
      <p>Tekan tombol ini untuk menyelesaikan verifikasi email.</p>
      {verifyState.message && <p role="status" className={verifyState.ok ? "text-teal-700" : "text-red-700"}>{verifyState.message}</p>}
      <button className="button-primary" type="submit" disabled={verifying || !token}>{verifying ? "Memverifikasi..." : "Verifikasi email"}</button>
      {verifyState.ok && <Link className="text-teal-700 underline" href="/login">Lanjut ke login</Link>}
    </form>
    <form action={resendAction} className="surface grid gap-4 p-6">
      <label className="form-field"><span className="form-label">Kirim ulang ke email</span><input className="form-input" name="email" type="email" required autoComplete="email" /></label>
      {resendState.message && <p role="status" className={resendState.ok ? "text-teal-700" : "text-red-700"}>{resendState.message}</p>}
      <button className="button-primary" type="submit" disabled={resending}>{resending ? "Mengirim..." : "Kirim ulang verifikasi"}</button>
    </form>
  </div>;
}
