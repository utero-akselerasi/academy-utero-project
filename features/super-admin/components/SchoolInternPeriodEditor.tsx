"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateInternPeriodAction } from "@/features/super-admin/actions";

type Props = {
  internId: string;
  name: string;
  startDate: string;
  endDate: string;
  major: string | null;
  gradeOrSemester: string | null;
  status: string;
  statusOptions: readonly { value: string; label: string }[];
};

export function SchoolInternPeriodEditor({ internId, name, startDate, endDate, major, gradeOrSemester, status, statusOptions }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  function save(formData: FormData) {
    startTransition(async () => {
      setError("");
      try {
        await updateInternPeriodAction(formData);
        setOpen(false);
      } catch {
        setError("Periode belum berhasil diperbarui. Periksa data lalu coba lagi.");
      }
    });
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-red-700">Edit periode</button>
    <dialog ref={dialog} onClose={() => setOpen(false)} onMouseDown={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }} aria-labelledby={`period-title-${internId}`} className="fixed inset-0 m-auto w-[calc(100%-1.5rem)] max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/60">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div><h2 id={`period-title-${internId}`} className="text-base font-bold text-slate-950">Atur periode peserta</h2><p className="mt-1 text-sm text-slate-600">{name}</p></div>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Tutup edit periode" className="rounded-lg px-2 py-1 text-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-red-700">&times;</button>
      </div>
      <form action={save} className="grid max-h-[min(75vh,640px)] gap-4 overflow-y-auto p-5 sm:grid-cols-2">
        <input type="hidden" name="internId" value={internId} />
        <label className="form-field"><span className="form-label">Mulai</span><input type="date" name="startDate" defaultValue={startDate} className="form-input w-full" /></label>
        <label className="form-field"><span className="form-label">Selesai</span><input type="date" name="endDate" defaultValue={endDate} className="form-input w-full" /></label>
        <label className="form-field"><span className="form-label">Jurusan</span><input name="major" defaultValue={major ?? ""} className="form-input w-full" /></label>
        <label className="form-field"><span className="form-label">Kelas / Semester</span><input name="gradeOrSemester" defaultValue={gradeOrSemester ?? ""} className="form-input w-full" /></label>
        <label className="form-field sm:col-span-2"><span className="form-label">Status</span><select name="status" defaultValue={status} className="form-input w-full">{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        {error ? <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p> : null}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2"><button type="button" onClick={() => dialog.current?.close()} className="button-secondary min-h-10">Batal</button><button type="submit" disabled={pending} className="button-primary min-h-10">{pending ? "Menyimpan..." : "Simpan perubahan"}</button></div>
      </form>
    </dialog>
  </>;
}
