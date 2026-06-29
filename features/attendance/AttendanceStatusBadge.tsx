import { type AttendanceStatus } from "./types";

const labels: Record<AttendanceStatus, string> = {
  pending: "Menunggu Review",
  valid: "Hadir (Valid)",
  invalid: "Tidak Valid",
  manual_review: "Review Manual",
};

const colors: Record<AttendanceStatus, string> = {
  pending: "bg-slate-100 text-slate-700 border-slate-300",
  valid: "bg-teal-50 text-teal-800 border-teal-300",
  invalid: "bg-red-50 text-red-800 border-red-300",
  manual_review: "bg-amber-50 text-amber-800 border-amber-300",
};

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}
