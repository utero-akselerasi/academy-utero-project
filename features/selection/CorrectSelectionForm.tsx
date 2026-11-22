"use client";

import { useState, useTransition } from "react";
import { correctSelectionAssignmentAction } from "./actions";
import type { SelectionTest } from "./types";

export function CorrectSelectionForm({ assignmentId, currentTestId, tests }: { assignmentId: string; currentTestId: string; tests: SelectionTest[] }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const alternatives = tests.filter((test) => test.id !== currentTestId);
  if (!alternatives.length) return null;
  function submit(data: FormData) {
    startTransition(async () => {
      setMessage("");
      try { const result = await correctSelectionAssignmentAction(data); setMessage(result && !result.ok ? (result.message ?? "Koreksi gagal.") : "Paket dikoreksi sebelum tes dimulai. Perubahan tersimpan dalam log audit."); }
      catch (error) { setMessage(error instanceof Error ? error.message : "Koreksi gagal. Coba lagi nanti."); }
    });
  }
  return <form action={submit} className="grid gap-2 rounded-lg border border-sky-200 bg-sky-50/50 p-3 sm:grid-cols-[1fr_1.4fr_auto]">
    <input type="hidden" name="assignmentId" value={assignmentId} />
    <label className="form-field"><span className="form-label">Koreksi paket (belum dimulai)</span><select className="form-input w-full" name="testId" required defaultValue=""><option value="" disabled>Pilih paket aktif</option>{alternatives.map((test) => <option key={test.id} value={test.id}>{test.title}</option>)}</select></label>
    <label className="form-field"><span className="form-label">Alasan koreksi (min. 15 karakter)</span><input className="form-input w-full" name="reason" minLength={15} maxLength={1000} required /></label>
    <button className="button-secondary min-h-10 text-sm" disabled={pending}>{pending ? "Memproses..." : "Koreksi paket"}</button>
    {message ? <p role="status" className="text-xs text-slate-700 sm:col-span-3">{message}</p> : null}
  </form>;
}
