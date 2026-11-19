"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { saveProgramAction, type ProgramActionState } from "@/features/admin/program-actions";
import { type AcademyProgram } from "@/features/admin/programs";

const initialState: ProgramActionState = { ok: false, message: "" };
const statuses = [
  { value: "draft", label: "Draf" },
  { value: "published", label: "Terbit" },
  { value: "archived", label: "Arsip" },
] as const;

type ActiveProgram = AcademyProgram | "new" | null;

function ProgramForm({ program, onSaved }: { program?: AcademyProgram; onSaved: () => void }) {
  const [state, action, pending] = useActionState(saveProgramAction, initialState);

  useEffect(() => {
    if (state.ok) onSaved();
  }, [onSaved, state.ok]);

  return <form action={action} className="grid gap-4 p-5 sm:grid-cols-2">
    {program && <input type="hidden" name="id" value={program.id} />}
    <label className="form-field"><span className="form-label">Nama program</span><input className="form-input" name="name" defaultValue={program?.name} required minLength={3} maxLength={150} /></label>
    <label className="form-field"><span className="form-label">Slug URL (opsional)</span><input className="form-input" name="slug" defaultValue={program?.slug} maxLength={180} placeholder="Dibuat otomatis dari nama" /></label>
    <label className="form-field"><span className="form-label">Jenis program</span><input className="form-input" name="type" defaultValue={program?.type ?? "internship"} required maxLength={80} /></label>
    <label className="form-field"><span className="form-label">Status</span><select className="form-input" name="status" defaultValue={program?.status ?? "draft"}>{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}{status.value === "published" ? " - tampil untuk pelamar" : ""}</option>)}</select></label>
    <label className="form-field sm:col-span-2"><span className="form-label">Deskripsi</span><textarea className="form-input min-h-24" name="description" defaultValue={program?.description ?? ""} maxLength={5000} /></label>
    {state.message && <p role={state.ok ? "status" : "alert"} className={`text-sm font-semibold sm:col-span-2 ${state.ok ? "text-teal-700" : "text-red-700"}`}>{state.message}</p>}
    <div className="flex justify-end gap-3 sm:col-span-2">
      <button className="button-secondary min-h-11" type="button" onClick={onSaved}>Batal</button>
      <button className="button-primary min-h-11" type="submit" disabled={pending}>{pending ? "Menyimpan..." : program ? "Simpan perubahan" : "Tambah program"}</button>
    </div>
  </form>;
}

export function ProgramsManager({ programs }: { programs: AcademyProgram[] }) {
  const [activeProgram, setActiveProgram] = useState<ActiveProgram>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const published = programs.filter((program) => program.status === "published").length;
  const closeDialog = useCallback(() => {
    dialogRef.current?.close();
    setActiveProgram(null);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (activeProgram !== null && dialog && !dialog.open) dialog.showModal();
    if (activeProgram === null && dialog?.open) dialog.close();
  }, [activeProgram]);

  return <div className="grid gap-6">
    <section className="rounded-3xl bg-slate-950 p-6 text-white md:p-8">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-teal-300">Katalog pendaftaran</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
        <div><h1 className="text-3xl font-bold">Program Magang</h1><p className="mt-2 max-w-2xl text-slate-300">Program berstatus Terbit muncul di pilihan formulir pelamar.</p></div>
        <p className="rounded-full border border-white/20 px-4 py-2 text-sm">{published} terbit / {programs.length} total</p>
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
        <div><h2 className="text-lg font-bold text-slate-950">Daftar program</h2><p className="mt-1 text-sm text-slate-600">Kelola program pendaftaran dari satu tabel.</p></div>
        <button type="button" onClick={() => setActiveProgram("new")} className="button-primary min-h-11"><Plus size={17} aria-hidden="true" />Tambah program</button>
      </header>
      {programs.length ? <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th scope="col" className="px-5 py-3 font-semibold">Nama program</th><th scope="col" className="px-5 py-3 font-semibold">Jenis</th><th scope="col" className="px-5 py-3 font-semibold">Status</th><th scope="col" className="px-5 py-3 text-right font-semibold">Aksi</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{programs.map((program) => <tr key={program.id} className="hover:bg-slate-50/70">
            <td className="px-5 py-4"><p className="font-semibold text-slate-950">{program.name}</p><p className="mt-1 text-xs text-slate-500">/{program.slug}</p></td>
            <td className="px-5 py-4 text-slate-700">{program.type}</td>
            <td className="px-5 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${program.status === "published" ? "bg-teal-50 text-teal-800" : program.status === "draft" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{statuses.find((status) => status.value === program.status)?.label}</span></td>
            <td className="px-5 py-4 text-right"><button type="button" onClick={() => setActiveProgram(program)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"><Pencil size={15} aria-hidden="true" />Edit</button></td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="p-8 text-center text-sm text-slate-600">Belum ada program. Tekan “Tambah program” untuk mulai.</p>}
    </section>

    <dialog ref={dialogRef} aria-labelledby="program-dialog-title" onClose={() => setActiveProgram(null)} onClick={(event) => { if (event.target === event.currentTarget) closeDialog(); }} className="m-auto w-[min(42rem,calc(100%-2rem))] max-w-none rounded-2xl border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/50">
      {activeProgram !== null ? <>
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div><h2 id="program-dialog-title" className="text-xl font-bold">{activeProgram === "new" ? "Tambah program" : "Edit program"}</h2><p className="mt-1 text-sm text-slate-600">Program Terbit tersedia untuk dipilih pelamar.</p></div>
          <button type="button" aria-label="Tutup formulir" onClick={closeDialog} className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"><X size={19} aria-hidden="true" /></button>
        </header>
        <ProgramForm key={activeProgram === "new" ? "new-program" : activeProgram.id} program={activeProgram === "new" ? undefined : activeProgram} onSaved={closeDialog} />
      </> : null}
    </dialog>
  </div>;
}
