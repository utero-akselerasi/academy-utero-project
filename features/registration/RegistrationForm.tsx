"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { submitRegistrationAction, type RegistrationState } from "./actions";

type Props = { userId: string; email: string; fullName: string; programs: Array<{ id: string; name: string }> };
const initialState: RegistrationState = { ok: false, message: "" };
const maxFileBytes = 5 * 1024 * 1024;

export function RegistrationForm({ userId, email, fullName, programs }: Props) {
  const [state, formAction, pending] = useActionState(submitRegistrationAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [fileError, setFileError] = useState("");
  const [dateError, setDateError] = useState("");
  const draftKey = `academy:registration-draft:${userId}`;

  useEffect(() => {
    if (state.ok) {
      try { localStorage.removeItem(draftKey); } catch { return; }
      return;
    }
    const form = formRef.current;
    if (!form) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (!saved) return;
      const draft = JSON.parse(saved) as Record<string, string>;
      for (const [name, value] of Object.entries(draft)) {
        if (typeof value !== "string") continue;
        const field = form.elements.namedItem(name);
        if (field instanceof HTMLInputElement && field.type !== "file") field.value = value;
        else if (field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) field.value = value;
      }
    } catch { return; }
  }, [draftKey, state]);

  function saveDraft() {
    if (!formRef.current) return;
    const draft = Object.fromEntries([...new FormData(formRef.current)].filter(([name]) => name !== "cv" && name !== "portfolio"));
    try { localStorage.setItem(draftKey, JSON.stringify(draft)); } catch { return; }
  }

  function checkFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file && file.size > maxFileBytes) {
      event.currentTarget.value = "";
      setFileError(`${event.currentTarget.name === "cv" ? "CV" : "Portofolio"} maksimal 5 MB. Pilih berkas lain.`);
    } else setFileError("");
  }

  function checkDates(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const start = (form.elements.namedItem("proposedStartDate") as HTMLInputElement).value;
    const end = (form.elements.namedItem("proposedEndDate") as HTMLInputElement).value;
    if (start && end && end < start) {
      event.preventDefault();
      setDateError("Tanggal selesai tidak boleh sebelum tanggal mulai.");
    } else setDateError("");
  }

  return <form ref={formRef} action={formAction} onInput={saveDraft} onChange={saveDraft} onSubmit={checkDates} className="surface grid gap-4 p-6" encType="multipart/form-data">
    {state.message ? <p role="status" className={state.ok ? "text-teal-700" : "text-red-700"}>{state.message}</p> : null}
    {fileError || dateError ? <p role="alert" className="text-red-700">{fileError || dateError}</p> : null}
    <p className="text-sm text-slate-600">Isian tersimpan di browser ini sampai pendaftaran berhasil. CV dan portofolio perlu dipilih kembali setelah halaman ditutup.</p>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="form-field"><span className="form-label">Nama lengkap</span><input className="form-input" name="fullName" defaultValue={fullName} required /></label>
      <label className="form-field"><span className="form-label">Email akun</span><input className="form-input" value={email} readOnly disabled /></label>
      <label className="form-field"><span className="form-label">Program</span><select className="form-input" name="programId" required disabled={programs.length === 0}><option value="">{programs.length ? "Pilih program" : "Belum ada program terbit"}</option>{programs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{programs.length === 0 && <span className="text-sm text-amber-800">Pendaftaran belum dibuka. Hubungi admin untuk menerbitkan program.</span>}</label>
      <label className="form-field"><span className="form-label">Nomor WhatsApp</span><input className="form-input" name="phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="6281234567890" pattern="62[0-9]{8,13}" title="Angka saja, wajib diawali 62 (contoh: 6281234567890)" maxLength={15} required /><span className="text-xs text-slate-600">Angka saja, wajib diawali 62. Contoh: 6281234567890.</span></label>
      <label className="form-field"><span className="form-label">Sekolah atau kampus</span><input className="form-input" name="schoolName" required /></label>
      <label className="form-field"><span className="form-label">NIS/NIM</span><input className="form-input" name="studentNumber" /></label>
      <label className="form-field"><span className="form-label">Jurusan</span><input className="form-input" name="major" required /></label>
      <label className="form-field"><span className="form-label">Kode sekolah partner (opsional)</span><input className="form-input" name="referralCode" autoCapitalize="characters" /></label>
      <label className="form-field"><span className="form-label">Usulan mulai magang</span><input className="form-input" name="proposedStartDate" type="date" required /></label>
      <label className="form-field"><span className="form-label">Usulan selesai magang</span><input className="form-input" name="proposedEndDate" type="date" required /></label>
    </div>
    <label className="form-field"><span className="form-label">Motivasi</span><textarea className="form-input min-h-32" name="motivation" minLength={20} required /></label>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="form-field"><span className="form-label">CV (maksimal 5 MB)</span><input className="form-input" name="cv" type="file" accept="application/pdf,image/*" onChange={checkFile} required /></label>
      <label className="form-field"><span className="form-label">Portofolio (opsional, maksimal 5 MB)</span><input className="form-input" name="portfolio" type="file" accept="application/pdf,image/*" onChange={checkFile} /></label>
    </div>
    <button className="button-primary" disabled={pending || programs.length === 0}>{pending ? "Mengirim..." : "Kirim pendaftaran"}</button>
  </form>;
}