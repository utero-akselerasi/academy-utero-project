"use client";

import { useActionState } from "react";
import { createSchoolApplicationAction, importSchoolApplicationsCsvAction } from "../actions";
import type { BulkImportState, CreateApplicationState } from "../types";

const createInitial: CreateApplicationState = { ok: false, message: "" };
const importInitial: BulkImportState = { ok: false, message: "", total: 0, created: 0, failed: 0, rows: [] };

function Field({ label, name, type = "text", required = true }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-slate-700">
      {label}
      <input className="rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-blue-600" name={name} type={type} required={required} />
    </label>
  );
}

export function CreateApplicationForm() {
  const [state, action, pending] = useActionState(createSchoolApplicationAction, createInitial);
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <Field label="Nama lengkap" name="fullName" />
      <Field label="Email peserta" name="email" type="email" />
      <Field label="Nomor WhatsApp/telepon" name="phone" type="tel" />
      <Field label="NIS/NIM" name="studentNumber" />
      <Field label="Jurusan" name="major" />
      <div />
      <Field label="Usulan mulai magang" name="proposedStartDate" type="date" />
      <Field label="Usulan selesai magang" name="proposedEndDate" type="date" />
      <label className="grid gap-1 text-sm font-semibold text-slate-700 md:col-span-2">
        Catatan/motivasi (opsional)
        <textarea className="min-h-28 rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-blue-600" name="motivation" maxLength={2000} />
      </label>
      {state.message ? <p role="status" className={`md:col-span-2 text-sm font-semibold ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p> : null}
      <button className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60 md:col-span-2" disabled={pending} type="submit">
        {pending ? "Menyimpan..." : "Kirim pendaftaran peserta"}
      </button>
    </form>
  );
}

export function BulkImportForm() {
  const [state, action, pending] = useActionState(importSchoolApplicationsCsvAction, importInitial);
  return (
    <div className="space-y-5">
      <form action={action} className="grid gap-3">
        <p className="text-sm leading-6 text-slate-600">Header wajib: <code className="break-all text-xs">full_name,email,phone,student_number,major,motivation,proposed_start_date,proposed_end_date</code>. Maksimal 200 baris dan 1 MB.</p>
        <input accept=".csv,text/csv" className="rounded-xl border border-dashed border-slate-300 p-4 text-sm" name="csv" type="file" required />
        <button className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60" disabled={pending} type="submit">
          {pending ? "Memvalidasi dan mengimpor..." : "Validasi dan import CSV"}
        </button>
      </form>
      {state.message ? <p role="status" className={`text-sm font-semibold ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p> : null}
      {state.rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-3">Baris</th><th className="p-3">Peserta</th><th className="p-3">NIS/NIM</th><th className="p-3">Hasil</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {state.rows.map((row) => <tr key={`${row.row}-${row.email}`}><td className="p-3">{row.row}</td><td className="p-3"><strong>{row.fullName || "-"}</strong><br /><span className="text-xs text-slate-500">{row.email || "-"}</span></td><td className="p-3">{row.studentNumber || "-"}</td><td className="p-3"><span className={row.status === "created" ? "font-bold text-emerald-700" : "font-bold text-rose-700"}>{row.status}</span>{row.errors.length ? <p className="mt-1 text-xs text-rose-600">{row.errors.join(" ")}</p> : null}</td></tr>)}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
