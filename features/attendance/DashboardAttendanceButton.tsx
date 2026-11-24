"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, CheckCircle2, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckInForm } from "./CheckInForm";
import { CheckOutForm } from "./CheckOutForm";

type Props = {
  statusLabel: string;
  statusColor: string;
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  isPermitOrSick: boolean;
};

export function DashboardAttendanceButton({ statusLabel, statusColor, hasCheckedIn, hasCheckedOut, isPermitOrSick }: Props) {
  const [open, setOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const complete = useCallback((message: string) => {
    setSuccessMessage(message);
    setOpen(false);
    router.refresh();
  }, [router]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
  }, [open]);

  return <>
    <div className="w-full self-stretch md:w-auto md:self-auto">
    <button type="button" onClick={() => { setSuccessMessage(""); setOpen(true); }} aria-haspopup="dialog" className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-250 hover:border-teal-500 hover:bg-slate-100/50 p-3.5 rounded-xl self-stretch md:self-auto transition-all cursor-pointer group text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
      <span className="flex items-center gap-3">
        <span className="rounded-lg bg-teal-100 p-2.5 text-teal-800 shrink-0 group-hover:bg-teal-200 transition-colors"><Calendar size={20} /></span>
        <span><span className="text-[10px] text-slate-500 font-bold uppercase block">Absensi Hari Ini</span><span className={`px-2 py-0.5 rounded text-xs font-extrabold uppercase border ${statusColor}`}>{statusLabel}</span></span>
      </span>
      <ChevronRight size={16} aria-hidden="true" className="text-slate-500 group-hover:text-teal-700" />
    </button>
    {successMessage && <p role="status" aria-live="polite" className="mt-2 flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-900">
      <CheckCircle2 size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-teal-700" />
      <span>{successMessage} Status absensi hari ini sudah diperbarui.</span>
    </p>}
    </div>
    {open && <dialog ref={dialogRef} onCancel={() => setOpen(false)} aria-labelledby="quick-attendance-title" className="m-auto w-[calc(100%-2rem)] max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/65">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
        <div><p className="text-[10px] font-bold uppercase tracking-widest text-teal-700">Absensi cepat</p><h2 id="quick-attendance-title" className="text-base font-bold text-slate-950">{hasCheckedIn && !hasCheckedOut ? "Absen pulang" : "Absen hari ini"}</h2></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Tutup popup absensi" className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"><X size={18} /></button>
      </div>
      <div className="p-3 sm:p-4">
        {isPermitOrSick || hasCheckedOut ? <p className="rounded-xl bg-teal-50 p-5 text-sm font-medium text-teal-950">{isPermitOrSick ? "Izin atau sakit sudah tercatat untuk hari ini." : "Check-in dan check-out hari ini sudah selesai."}</p> : hasCheckedIn ? <CheckOutForm autoStartCamera onComplete={complete} /> : <CheckInForm autoStartCamera onComplete={complete} />}
        <Link href="/dashboard/intern/attendance" className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-teal-800 hover:underline">Lihat riwayat dan pengajuan izin</Link>
      </div>
    </dialog>}
  </>;
}
