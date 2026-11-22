"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { startApplicantSelectionAction } from "@/features/registration/selection-actions";

export function StartSelectionForm({ assignmentId }: { assignmentId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();
  function start() {
    const data = new FormData();
    data.set("assignmentId", assignmentId);
    startTransition(async () => {
      try {
        await startApplicantSelectionAction(data);
        router.push("/dashboard/applicant/selection/" + assignmentId);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Tes tidak dapat dimulai. Coba lagi nanti.");
      }
    });
  }
  return <div className="w-full shrink-0 sm:w-auto">
    {confirming ? <div className="grid gap-2 rounded-xl border border-teal-200 bg-white p-3 text-sm">
      <p className="max-w-sm font-semibold text-slate-900">Siap mulai? Waktu pengerjaan langsung berjalan setelah Anda konfirmasi.</p>
      <div className="flex flex-wrap gap-2"><button type="button" className="button-primary" disabled={pending} onClick={start}>{pending ? "Memulai..." : "Ya, mulai tes"}</button><button type="button" className="button-secondary" disabled={pending} onClick={() => setConfirming(false)}>Batal</button></div>
    </div> : <button type="button" className="button-primary w-full sm:w-auto" onClick={() => setConfirming(true)}>Mulai tes <ArrowUpRight size={16} aria-hidden="true" /></button>}
    {message ? <p role="status" className="mt-2 max-w-sm text-xs text-rose-800">{message}</p> : null}
  </div>;
}
