import { type ReportStatus } from "./types";

const statusLabels: Record<ReportStatus, string> = {
  submitted: "Dikirim",
  approved: "Disetujui",
  revision_requested: "Revisi",
};

const statusColors: Record<ReportStatus, string> = {
  submitted: "border-amber-300 bg-amber-50 text-amber-800",
  approved: "border-teal-300 bg-teal-50 text-teal-800",
  revision_requested: "border-red-300 bg-red-50 text-red-800",
};

type Props = {
  status: ReportStatus;
};

export function ReportStatusBadge({ status }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${statusColors[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
