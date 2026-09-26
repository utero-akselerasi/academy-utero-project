"use client";

import { generateSchoolReportAction, type GenerateSchoolReportState } from "@/features/school/actions";
import { useActionState } from "react";

const initialState: GenerateSchoolReportState = { ok: false, message: "" };

type Props = {
  defaultFrom?: string;
  defaultTo?: string;
};

/**
 * Form generate laporan dipindah dari GET ke server action (POST).
 * Versi GET sebelumnya menulis ke school_reports setiap kali URL dimuat,
 * sehingga prefetch atau tautan pihak ketiga bisa memicu penulisan data.
 */
export function GenerateReportForm({ defaultFrom, defaultTo }: Props) {
  const [state, formAction, pending] = useActionState(generateSchoolReportAction, initialState);

  return (
    <form action={formAction} className="mt-4 grid gap-3 md:grid-cols-4">
      <div>
        <label htmlFor="report-from" className="mb-1 block text-xs font-bold text-slate-600">Dari Tanggal</label>
        <input
          id="report-from"
          type="date"
          name="from"
          required
          defaultValue={defaultFrom}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="report-to" className="mb-1 block text-xs font-bold text-slate-600">Sampai Tanggal</label>
        <input
          id="report-to"
          type="date"
          name="to"
          required
          defaultValue={defaultTo}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {pending ? "Memproses..." : "Generate"}
        </button>
      </div>
      {state.message && (
        <p role="status" className="md:col-span-4 text-sm font-medium text-rose-700">{state.message}</p>
      )}
    </form>
  );
}
