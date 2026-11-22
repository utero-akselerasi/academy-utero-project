"use client";

import { useState, useTransition } from "react";
import { assignSelectionTestAction } from "./actions";
import type { SelectionTest } from "./types";

type Props = {
  applications: Array<{ id: string; full_name: string; email: string }>;
  tests: SelectionTest[];
};

export function AssignSelectionForm({ applications, tests }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(false);

  function submit(formData: FormData) {
    formData.set("retry", retry ? "true" : "false");
    startTransition(async () => {
      setMessage("");
      try {
        const result = await assignSelectionTestAction(formData);
        if (result && !result.ok) { setMessage(result.message ?? "Penugasan gagal."); return; }
        setMessage(retry ? "Penugasan ulang dibuat. Histori sebelumnya tetap tersimpan." : "Tes berhasil ditugaskan.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Penugasan gagal. Muat ulang lalu coba lagi.");
      }
    });
  }

  return <form action={submit} className="mt-5 grid gap-4 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
    <label className="form-field"><span className="form-label">Calon peserta</span><select className="form-input w-full" name="applicationId" required><option value="">Pilih pelamar</option>{applications.map((applicant) => <option key={applicant.id} value={applicant.id}>{applicant.full_name} · {applicant.email}</option>)}</select></label>
    <label className="form-field"><span className="form-label">Paket tes aktif</span><select className="form-input w-full" name="testId" required><option value="">Pilih tes terbit</option>{tests.map((test) => <option key={test.id} value={test.id}>{test.title}</option>)}</select></label>
    <label className="form-field"><span className="form-label">Batas waktu (opsional)</span><input className="form-input w-full" name="dueAt" type="datetime-local" /></label>
    <button className="button-primary min-h-11 text-sm" disabled={pending}>{pending ? "Memproses..." : retry ? "Buat penugasan ulang" : "Tugaskan tes"}</button>
    <div className="grid gap-2 sm:col-span-2 lg:col-span-4">
      <label className="flex min-h-10 items-start gap-2 text-xs leading-5 text-slate-700"><input type="checkbox" checked={retry} onChange={(event) => setRetry(event.target.checked)} className="mt-1" /><span>Penugasan ulang setelah tes kedaluwarsa tanpa jawaban. Tes aktif atau menunggu penilaian tidak dapat ditugaskan ulang.</span></label>
      {retry ? <label className="form-field"><span className="form-label">Alasan penugasan ulang (wajib)</span><input className="form-input w-full" name="reason" minLength={15} maxLength={1000} required placeholder="Contoh: tes terpicu tidak sengaja dan kedaluwarsa tanpa jawaban" /></label> : null}
      {message ? <p role="status" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">{message}</p> : null}
    </div>
  </form>;
}
