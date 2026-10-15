"use client";

import Link from "next/link";
import { useActionState } from "react";
import { acceptInvitationAction } from "@/features/auth/accept-invitation-action";

export function InviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitationAction, { ok: false, message: "" });
  return <form action={action} className="surface grid gap-4 p-6">
    <input type="hidden" name="token" value={token} />
    <label className="form-field"><span className="form-label">Password baru</span><input className="form-input" type="password" name="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label>
    {state.message && <p role="status" className={state.ok ? "text-teal-700" : "text-red-700"}>{state.message}</p>}
    <button className="button-primary" type="submit" disabled={pending || state.ok || !token}>{pending ? "Menyimpan..." : "Aktifkan akun"}</button>
    {state.ok && <Link href="/login">Masuk</Link>}
  </form>;
}
