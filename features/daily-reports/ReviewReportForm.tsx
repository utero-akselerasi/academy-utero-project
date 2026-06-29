"use client";

import { reviewDailyReportAction } from "@/features/daily-reports/actions";
import { type ReportStatus } from "@/features/daily-reports/types";

type Props = {
  reportId: string;
  currentStatus: ReportStatus;
};

export function ReviewReportForm({ reportId, currentStatus }: Props) {
  if (currentStatus === "approved") {
    return null;
  }

  const noteFieldId = "note-" + reportId;

  return (
    <form action={reviewDailyReportAction} className="mt-4 grid gap-3 border-t border-slate-200 pt-4">
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

      <div className="flex flex-wrap gap-2">
        <button
          className="button-primary text-sm"
          name="status"
          type="submit"
          value="approved"
        >
          Setujui
        </button>
        <button
          className="button-secondary text-sm"
          name="status"
          type="submit"
          value="revision_requested"
        >
          Minta Revisi
        </button>
      </div>
    </form>
  );
}
