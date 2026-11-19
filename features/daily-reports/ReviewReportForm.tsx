"use client";

import { useActionState } from "react";
import { reviewDailyReportAction, type ReviewReportState } from "@/features/daily-reports/actions";
import { type ReportStatus } from "@/features/daily-reports/types";

const initialState: ReviewReportState = { ok: false, message: "" };

type Props = {
  reportId: string;
  currentStatus: ReportStatus;
};

export function ReviewReportForm({ reportId, currentStatus }: Props) {
  const [state, formAction, isPending] = useActionState(reviewDailyReportAction, initialState);

  if (currentStatus === "approved") {
    return null;
  }

  const noteFieldId = "note-" + reportId;

  return (
    <form action={formAction} className="mt-4 grid gap-3 border-t border-slate-200 pt-4">
      <input name="reportId" type="hidden" value={reportId} />

      <div className="form-field">
        <label className="form-label" htmlFor={noteFieldId}>
          Catatan Review
        </label>
        <textarea
          className="form-input"
          id={noteFieldId}
          name="note"
          placeholder="Catatan opsional untuk peserta..."
          rows={2}
        />
      </div>

      {state.message && (
        <p className={`text-sm font-semibold ${state.ok ? "text-teal-700" : "text-red-700"}`} role="status">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          className="button-primary text-sm"
          name="status"
          type="submit"
          value="approved"
          disabled={isPending}
        >
          {isPending ? "Menyimpan..." : "Setujui"}
        </button>
        <button
          className="button-secondary text-sm"
          name="status"
          type="submit"
          value="revision_requested"
          disabled={isPending}
        >
          Minta Revisi
        </button>
      </div>
    </form>
  );
}
