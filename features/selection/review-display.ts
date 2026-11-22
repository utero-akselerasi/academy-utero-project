import { effectiveAttemptStatus } from "./attempt-status";
import type { SelectionAssignmentReview } from "./types";

export function reviewStatus(assignment: SelectionAssignmentReview, now: number) {
  const status = effectiveAttemptStatus(assignment.attempt, assignment.due_at, assignment.test?.available_until ?? null, now);
  if (["passed", "failed", "waitlisted"].includes(assignment.status) && assignment.applicant?.selection_status === assignment.status) {
    const decisions: Record<string, string> = { passed: "Lulus", failed: "Tidak lulus", waitlisted: "Daftar tunggu" };
    return { label: decisions[assignment.status], tone: "bg-emerald-50 text-emerald-800" };
  }
  const labels: Record<string, string> = { expired: "Waktu habis", submitted: "Jawaban masuk", grading: "Sedang dinilai", graded: "Menunggu keputusan", in_progress: "Sedang dikerjakan", cancelled: "Dibatalkan" };
  return { label: labels[status ?? ""] ?? "Belum dimulai", tone: status === "expired" ? "bg-rose-50 text-rose-800" : status === "submitted" || status === "grading" || status === "graded" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700" };
}

export function reviewTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(date);
}

export function reviewDuration(assignment: SelectionAssignmentReview, now: number) {
  const attempt = assignment.attempt;
  if (!attempt?.started_at) return "Belum dimulai";
  const start = Date.parse(attempt.started_at);
  const status = effectiveAttemptStatus(attempt, assignment.due_at, assignment.test?.available_until ?? null, now);
  if (status !== "expired" && status !== "in_progress" && !attempt.submitted_at) return "-";
  const end = status === "expired" ? Math.min(...[attempt.expires_at, assignment.due_at, assignment.test?.available_until].filter((value): value is string => !!value).map(Date.parse)) : attempt.submitted_at ? Date.parse(attempt.submitted_at) : now;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "-";
  const minutes = Math.max(0, Math.floor((end - start) / 60000));
  return `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} jam ` : ""}${minutes % 60} menit${status === "in_progress" ? " (berjalan)" : ""}`;
}
