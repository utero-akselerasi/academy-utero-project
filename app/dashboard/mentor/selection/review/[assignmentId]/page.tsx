import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/features/auth/guards";
import { getSelectionWorkspace } from "@/features/selection/queries";
import { CorrectSelectionForm } from "@/features/selection/CorrectSelectionForm";
import { decideSelectionAction, gradeSelectionAnswerAction } from "@/features/selection/actions";
import { effectiveAttemptStatus } from "@/features/selection/attempt-status";
import { reviewDuration, reviewStatus, reviewTime } from "@/features/selection/review-display";

const field = "form-input w-full";

export default async function SelectionReviewDetailPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  await requireAdmin();
  const { assignmentId } = await params;
  const workspace = await getSelectionWorkspace();
  const assignment = workspace.assignments.find((item) => item.id === assignmentId);
  if (!assignment) notFound();

  const status = reviewStatus(assignment, workspace.currentTime);
  const expired = effectiveAttemptStatus(assignment.attempt, assignment.due_at, assignment.test?.available_until ?? null, workspace.currentTime) === "expired";
  const graded = assignment.attempt?.status === "graded" && assignment.attempt.final_score !== null;
  const canGrade = ["submitted", "grading", "graded"].includes(assignment.attempt?.status ?? "");
  const publishedTests = workspace.tests.filter((test) => test.is_published && test.is_active);

  return <main className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
    <Link href="/dashboard/mentor/selection#review" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"><ArrowLeft size={16} aria-hidden="true" />Kembali ke daftar review</Link>
    <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wide text-teal-800">Review tes seleksi</p><h1 className="mt-1 text-xl font-bold text-slate-950">{assignment.applicant?.full_name ?? assignment.application_id}</h1><p className="mt-1 text-sm text-slate-600">{assignment.applicant?.email} · {assignment.test?.title ?? "Paket tes"}</p></div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status.tone}`}>{status.label}</span>
      </div>
      <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3"><div><dt className="text-xs text-slate-500">Mulai dikerjakan</dt><dd className="mt-1 font-medium text-slate-800">{reviewTime(assignment.attempt?.started_at)}</dd></div><div><dt className="text-xs text-slate-500">Jawaban dikirim</dt><dd className="mt-1 font-medium text-slate-800">{reviewTime(assignment.attempt?.submitted_at)}</dd></div><div><dt className="text-xs text-slate-500">Durasi</dt><dd className="mt-1 font-medium text-slate-800">{reviewDuration(assignment, workspace.currentTime)}</dd></div></dl>
    </header>

    {!assignment.attempt ? <section className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="font-bold text-slate-950">Perbaiki penugasan</h2><p className="mt-1 text-sm text-slate-600">Pelamar belum memulai tes. Ganti paket jika penugasan keliru.</p><div className="mt-3"><CorrectSelectionForm assignmentId={assignment.id} currentTestId={assignment.package_id} tests={publishedTests} /></div></section> : null}
    {expired && !assignment.attempt?.answers.length ? <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950">Waktu tes habis tanpa jawaban. Tidak ada jawaban untuk dinilai. Berikan kesempatan ulang melalui formulir penugasan ulang di daftar seleksi.</p> : null}
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="font-bold text-slate-950">Jawaban pelamar</h2><span className="text-xs text-slate-500">{assignment.attempt?.answers.length ?? 0} respons</span></div>
      {assignment.attempt?.answers.length ? assignment.attempt.answers.map((answer, index) => <article key={answer.id} className="rounded-lg border border-slate-200 p-3 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Soal {index + 1} · {answer.question?.points ?? 0} poin</p><h3 className="mt-1 font-semibold leading-6 text-slate-950">{answer.question?.prompt ?? "Pertanyaan"}</h3>
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-800">{answer.answer_text || answer.attachment_path || "Tidak ada jawaban tertulis."}</p>
        {answer.question?.type === "file_upload" && /^https:\/\/(?:drive|docs)\.google\.com\//.test(answer.answer_text ?? "") ? <a className="mt-2 inline-flex min-h-10 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-800 hover:bg-red-100" href={answer.answer_text ?? "#"} target="_blank" rel="noopener noreferrer">Buka tautan Google Drive</a> : null}
        {canGrade ? <form action={gradeSelectionAnswerAction} className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end"><input type="hidden" name="answerId" value={answer.id} /><input type="hidden" name="assignmentId" value={assignment.id} /><input type="hidden" name="maxPoints" value={answer.question?.points ?? 0} /><label className="form-field"><span className="form-label">Nilai (maks. {answer.question?.points ?? 0})</span><input className={field} type="number" name="awardedPoints" min="0" max={answer.question?.points ?? 0} defaultValue={answer.manual_score ?? ""} required /></label><label className="form-field"><span className="form-label">Umpan balik (opsional)</span><input className={field} name="feedback" defaultValue={answer.feedback ?? ""} /></label><button className="button-secondary min-h-11 text-sm">Simpan nilai</button></form> : answer.manual_score !== null ? <p className="mt-3 text-sm font-semibold text-teal-800">Nilai tersimpan: {answer.manual_score}</p> : null}
      </article>) : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Pelamar belum mengirim jawaban tes.</p>}
      {graded ? <form action={decideSelectionAction} className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end"><input type="hidden" name="assignmentId" value={assignment.id} /><input type="hidden" name="applicationId" value={assignment.application_id} /><label className="form-field"><span className="form-label">Keputusan</span><select className={field} name="decision"><option value="passed">Lulus</option><option value="failed">Tidak lulus</option><option value="waitlisted">Daftar tunggu</option></select></label><label className="form-field"><span className="form-label">Catatan</span><input className={field} name="notes" /></label><button className="button-primary min-h-11 text-sm">Simpan keputusan</button></form> : !assignment.attempt ? null : <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Keputusan aktif setelah tes dinilai dan seluruh penilaian manual tersimpan.</p>}
    </section>
  </main>;
}
