"use client";

import { useActionState } from "react";
import { updateApplicationPeriodAction, type ApplicationStatusActionState } from "@/features/admin/actions";

const initialState: ApplicationStatusActionState = { ok: false, message: "" };

export function ApplicationPeriodForm({ id, startDate, endDate }: { id: string; startDate: string; endDate: string }) {
  const [state, action, pending] = useActionState(updateApplicationPeriodAction, initialState);
  return <form action={action} className="mt-3 grid gap-3 rounded-lg border border-red-200 bg-white p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
    <input type="hidden" name="id" value={id} />
    <label className="form-field"><span className="form-label">Tanggal mulai baru</span><input className="form-input" type="date" name="startDate" defaultValue={startDate.slice(0, 10)} required /></label>
    <label className="form-field"><span className="form-label">Tanggal selesai baru</span><input className="form-input" type="date" name="endDate" defaultValue={endDate.slice(0, 10)} required /></label>
    <button type="submit" disabled={pending} className="button-primary min-h-11 text-sm">{pending ? "Menyimpan..." : "Ubah periode"}</button>
    {state.message ? <p role="status" className={`text-sm sm:col-span-3 ${state.ok ? "text-emerald-800" : "text-red-700"}`}>{state.message}</p> : null}
  </form>;
}
