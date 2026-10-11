"use client";

import { useActionState } from "react";
import { submitRegistrationAction, type RegistrationState } from "./actions";

type Props = { email: string; fullName: string; programs: Array<{ id: string; name: string }> };
const initialState: RegistrationState = { ok: false, message: "" };

export function RegistrationForm({ email, fullName, programs }: Props) {
  const [state, formAction, pending] = useActionState(submitRegistrationAction, initialState);
  return <form action={formAction} className="surface grid gap-4 p-6" encType="multipart/form-data">
    {state.message ? <p role="status" className={state.ok ? "text-teal-700" : "text-red-700"}>{state.message}</p> : null}
    <div className="grid gap-4 md:grid-cols-2">
      <label className="form-field"><span className="form-label">Nama lengkap</span><input className="form-input" name="fullName" defaultValue={fullName} required /></label>
      <label className="form-field"><span className="form-label">Email akun</span><input className="form-input" value={email} readOnly disabled /></label>
      <label className="form-field"><span className="form-label">Program</span><select className="form-input" name="programId" required><option value="">Pilih program</option>{programs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="form-field"><span className="form-label">Nomor WhatsApp</span><input className="form-input" name="phone" required /></label>
      <label className="form-field"><span className="form-label">Sekolah atau kampus</span><input className="form-input" name="schoolName" required /></label>
      <label className="form-field"><span className="form-label">NIS/NIM</span><input className="form-input" name="studentNumber" /></label>
      <label className="form-field"><span className="form-label">Jurusan</span><input className="form-input" name="major" required /></label>
      <label className="form-field"><span className="form-label">Kode sekolah partner (opsional)</span><input className="form-input" name="referralCode" autoCapitalize="characters" /></label>
      <label className="form-field"><span className="form-label">Usulan mulai magang</span><input className="form-input" name="proposedStartDate" type="date" required /></label>
      <label className="form-field"><span className="form-label">Usulan selesai magang</span><input className="form-input" name="proposedEndDate" type="date" required /></label>
    </div>
    <label className="form-field"><span className="form-label">Motivasi</span><textarea className="form-input min-h-32" name="motivation" minLength={20} required /></label>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="form-field"><span className="form-label">CV</span><input className="form-input" name="cv" type="file" accept="application/pdf,image/*" required /></label>
      <label className="form-field"><span className="form-label">Portofolio (opsional)</span><input className="form-input" name="portfolio" type="file" accept="application/pdf,image/*" /></label>
    </div>
    <button className="button-primary" disabled={pending || programs.length === 0}>{pending ? "Mengirim..." : "Kirim pendaftaran"}</button>
  </form>;
}
