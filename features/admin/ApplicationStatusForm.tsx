"use client";

import { approveApplicationOnboardingAction, updateApplicationStatusFormAction, type ApplicationStatusActionState } from "@/features/admin/actions";
import { Check, FileCheck, ShieldCheck, X } from "lucide-react";
import { useActionState, useState } from "react";
import Link from "next/link";

type Props = {
  id: string;
  status: string;
  selectionStatus: string | null;
  onboardingStatus: string | null;
  convertedInternId: string | null;
};

const initialState: ApplicationStatusActionState = { ok: false, message: "" };

export function ApplicationStatusForm({ id, status, selectionStatus, onboardingStatus, convertedInternId }: Props) {
  const [state, formAction, pending] = useActionState(updateApplicationStatusFormAction, initialState);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const applicationClosed = ["accepted", "converted", "rejected", "cancelled"].includes(status);
  const selectionPassed = ["passed", "bypassed"].includes(selectionStatus ?? "");
  const canApproveOnboarding = status === "accepted" && Boolean(convertedInternId) &&
    ["accepted_pending_onboarding", "biodata_review", "onboarding_complete"].includes(onboardingStatus ?? "");

  return (
    <div className="space-y-4">
      {state.message ? <p role="status" className={`rounded-lg p-3 text-xs leading-5 ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{state.message}</p> : null}
      {!applicationClosed ? (
        <>
          {status !== "reviewed" ? (
            <form action={formAction}>
              <input name="id" type="hidden" value={id} />
              <input name="status" type="hidden" value="reviewed" />
              <button disabled={pending} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-60" type="submit"><FileCheck size={16} aria-hidden="true" />{pending ? "Menyimpan..." : "Tandai sudah ditinjau"}</button>
            </form>
          ) : <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">Data sudah ditinjau. Pilih hasil akhir di bawah.</p>}

          {selectionPassed ? <form action={formAction} className="space-y-3 rounded-xl border border-teal-200 bg-white p-4">
            <input name="id" type="hidden" value={id} />
            <input name="status" type="hidden" value="accepted" />
            <h4 className="text-sm font-bold text-slate-950">Terima pelamar</h4>
            <p className="text-xs leading-5 text-slate-600">Pelamar lolos seleksi. Tetapkan periode resmi untuk membuat profil peserta magang.</p>
            <label className="block text-xs font-semibold text-slate-700">Mulai magang
              <input className="form-input mt-1 w-full text-sm" name="startDate" type="date" lang="id-ID" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
            </label>
            <label className="block text-xs font-semibold text-slate-700">Selesai magang
              <input className="form-input mt-1 w-full text-sm" name="endDate" type="date" lang="id-ID" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
            </label>
            <button disabled={pending} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-bold text-white transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-60" type="submit"><Check size={16} aria-hidden="true" />{pending ? "Menyimpan..." : "Terima & buat peserta"}</button>
          </form> : <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">Penerimaan belum tersedia. Tugaskan tes, nilai jawaban, lalu tetapkan hasil <strong>Lulus</strong> di <Link href="/dashboard/mentor/selection" className="font-semibold underline underline-offset-2">Seleksi Calon Peserta</Link>. Super Admin juga dapat mencatat bypass dengan alasan.</p>}

          <form action={formAction}>
            <input name="id" type="hidden" value={id} />
            <input name="status" type="hidden" value="rejected" />
            <button disabled={pending} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-60" type="submit"><X size={16} aria-hidden="true" />Tolak pendaftaran</button>
          </form>
        </>
      ) : <p className="rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">Keputusan pendaftaran sudah dicatat. Tidak ada tindakan review lanjutan.</p>}

      {canApproveOnboarding ? (
        <form action={approveApplicationOnboardingAction}>
          <input name="id" type="hidden" value={id} />
          <button className="button-primary min-h-11 w-full text-sm" type="submit"><ShieldCheck size={16} aria-hidden="true" />Setujui onboarding</button>
        </form>
      ) : null}
    </div>
  );
}