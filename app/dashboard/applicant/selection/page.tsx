import { StartSelectionForm } from "@/features/selection/StartSelectionForm";
import Link from "next/link";
import { ArrowUpRight, BookOpen, CalendarDays, CheckCircle2, ClipboardList, Clock3, FileText } from "lucide-react";
import { requireApplicant } from "@/features/auth/guards";
import { getApplicantSelectionData } from "@/features/registration/local-data";
import { effectiveAttemptStatus } from "@/features/selection/attempt-status";

const statusLabels: Record<string, string> = {
  not_assigned: "Belum ditugaskan", assigned: "Ditugaskan", available: "Siap dikerjakan",
  in_progress: "Sedang dikerjakan", submitted: "Jawaban terkirim", grading: "Sedang dinilai",
  graded: "Selesai dinilai", passed: "Lolos seleksi", failed: "Belum lolos",
  waitlisted: "Daftar tunggu", expired: "Waktu berakhir", bypassed: "Seleksi dilewati",
  cancelled: "Dibatalkan",
};

function displayStatus(value: string | null | undefined) {
  return value ? statusLabels[value] ?? value.replaceAll("_", " ") : "Belum diperbarui";
}

function statusColor(value: string | null | undefined) {
  if (["passed", "graded", "bypassed"].includes(value ?? "")) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["failed", "expired", "cancelled"].includes(value ?? "")) return "border-rose-200 bg-rose-50 text-rose-800";
  if (["in_progress", "submitted", "grading", "available"].includes(value ?? "")) return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function formatDeadline(value: string | null) {
  if (!value) return "Belum ditentukan";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Belum ditentukan";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
  }).format(date) + " WIB";
}

export default async function ApplicantSelectionPage() {
  await requireApplicant();
  const data = await getApplicantSelectionData();
  const pendingCount = data.assignments.filter((assignment) => {
    const attempt = data.attempts.find((item) => item.assignment_id === assignment.id);
    const test = data.packages.find((item) => item.id === assignment.package_id);
    const open = !!test?.is_published && (!test.available_from || data.currentTime >= Date.parse(test.available_from)) && (!test.available_until || data.currentTime < Date.parse(test.available_until)) && (!assignment.due_at || data.currentTime < Date.parse(assignment.due_at));
    return (!attempt && open) || (attempt?.status === "in_progress" && !!attempt.expires_at && data.currentTime < Date.parse(attempt.expires_at) && (!assignment.due_at || data.currentTime < Date.parse(assignment.due_at)));
  }).length;

  return <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
    <header className="relative isolate overflow-hidden rounded-2xl bg-slate-900 px-5 py-6 text-white shadow-sm sm:px-8 sm:py-7">
      <div aria-hidden="true" className="absolute -right-14 -top-24 -z-10 size-80 rounded-full border-[38px] border-white/5 sm:size-[27rem]" />
      <div aria-hidden="true" className="absolute bottom-0 left-0 h-1 w-28 bg-teal-500" />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-200">Calon peserta <span className="mx-1 text-white/40">/</span> Tes seleksi</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Seleksi Magang</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">Materi, tes yang ditugaskan, dan hasil seleksi. Semua langkah dalam satu tempat.</p></div>
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 md:min-w-52"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/20 text-teal-200"><ClipboardList size={18} aria-hidden="true" /></span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status seleksi</p><p className="truncate text-sm font-semibold">{data.applications.length ? displayStatus(data.applications[0].selection_status) : "Belum tersedia"}</p></div></div>
      </div>
    </header>

    <section aria-label="Ringkasan seleksi" className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><ClipboardList size={18} aria-hidden="true" /></span><div className="min-w-0"><p className="text-xl font-bold tabular-nums text-slate-900">{data.assignments.length}</p><p className="truncate text-xs text-slate-600 sm:text-sm">Tes ditugaskan</p></div></div>
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-800"><BookOpen size={18} aria-hidden="true" /></span><div className="min-w-0"><p className="text-xl font-bold tabular-nums text-slate-900">{data.materials.length}</p><p className="truncate text-xs text-slate-600 sm:text-sm">Materi tersedia</p></div></div>
      <div className="col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:col-span-1 sm:p-4"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-800"><Clock3 size={18} aria-hidden="true" /></span><div className="min-w-0"><p className="text-xl font-bold tabular-nums text-slate-900">{pendingCount}</p><p className="truncate text-xs text-slate-600 sm:text-sm">Siap atau sedang dikerjakan</p></div></div>
    </section>

    {data.applications.length ? <div className="space-y-4">{data.applications.map((application) => {
      const assignments = data.assignments.filter((item) => item.application_id === application.id);
      const materials = data.materials.filter((item) => item.track_id === application.selection_track_id);
      const results = data.results.find((item) => item.applicationId === application.id)?.rows ?? [];
      return <section key={application.id} className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.85fr)]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5"><div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{application.full_name.trim().slice(0, 1).toLocaleUpperCase("id-ID")}</span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pendaftaran</p><h2 className="truncate text-base font-bold text-slate-900">{application.full_name}</h2></div></div><span className={"rounded-full border px-2.5 py-1 text-xs font-semibold " + statusColor(application.selection_status)}>{displayStatus(application.selection_status)}</span></div>
          <div className="space-y-3 p-3 sm:p-5"><div className="flex items-center justify-between gap-3 px-1"><div><h3 className="text-sm font-bold text-slate-900">Tugas seleksi</h3><p className="text-xs text-slate-500">Tes untuk pendaftaran ini</p></div><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{assignments.length} tes</span></div>
            {assignments.length ? assignments.map((assignment) => {
              const test = data.packages.find((item) => item.id === assignment.package_id);
              const attempt = data.attempts.find((item) => item.assignment_id === assignment.id);
              const now = data.currentTime;
              const available = !!test?.is_published && (!test.available_from || now >= Date.parse(test.available_from)) && (!test.available_until || now < Date.parse(test.available_until)) && (!assignment.due_at || now < Date.parse(assignment.due_at));
              const attemptStatus = effectiveAttemptStatus(attempt, assignment.due_at, test?.available_until ?? null, now);
              const inProgress = attemptStatus === "in_progress";
              const canStart = available && (attempt?.attempt_number ?? 0) < assignment.max_attempts && (!attempt || ["graded", "expired", "cancelled"].includes(attempt.status));
              let hint = "Tes belum dibuka. Periksa kembali nanti.";
              if (!test?.is_published) hint = "Paket tes sedang disiapkan oleh tim seleksi.";
              else if (assignment.due_at && now >= Date.parse(assignment.due_at)) hint = "Batas waktu tes sudah lewat.";
              else if (test.available_from && now < Date.parse(test.available_from)) hint = "Tes dibuka " + formatDeadline(test.available_from) + ".";
              else if (test.available_until && now >= Date.parse(test.available_until)) hint = "Periode tes sudah berakhir.";
              else if (attempt?.status === "in_progress" && !inProgress) hint = "Waktu pengerjaan tes sudah berakhir.";
              else if (["submitted", "grading"].includes(attempt?.status ?? "")) hint = "Jawaban sudah dikirim dan menunggu penilaian.";
              else if (attempt && attempt.attempt_number >= assignment.max_attempts && !inProgress) hint = "Batas percobaan sudah digunakan.";
              return <article key={assignment.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h4 className="break-words text-base font-bold text-slate-900">{test?.title ?? "Tes seleksi"}</h4>{test?.description ? <p className="mt-1 text-sm leading-6 text-slate-600">{test.description}</p> : null}</div><span className={"rounded-full border px-2.5 py-1 text-xs font-semibold " + statusColor(attemptStatus ?? assignment.status)}>{displayStatus(attemptStatus ?? assignment.status)}</span></div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs leading-5 text-slate-600"><span className="inline-flex items-center gap-1.5"><Clock3 size={14} aria-hidden="true" />{test?.duration_minutes ?? "—"} menit</span><span className="inline-flex items-center gap-1.5"><CalendarDays size={14} aria-hidden="true" />Batas {formatDeadline(assignment.due_at)}</span><span className="inline-flex items-center gap-1.5"><FileText size={14} aria-hidden="true" />Percobaan {attempt?.attempt_number ?? 0}/{assignment.max_attempts}</span></div>
                <div className="mt-3 flex flex-col items-start justify-between gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:items-center"><p className="text-xs leading-5 text-slate-600">{inProgress ? "Tes belum selesai. Lanjutkan untuk menyimpan dan mengirim jawaban." : canStart ? "Siapkan waktu dan pastikan koneksi stabil sebelum mulai." : hint}</p>{inProgress ? <Link className="button-primary w-full shrink-0 sm:w-auto" href={"/dashboard/applicant/selection/" + assignment.id}>Lanjutkan tes <ArrowUpRight size={16} aria-hidden="true" /></Link> : canStart ? <StartSelectionForm assignmentId={assignment.id} /> : null}</div>
              </article>;
            }) : <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center"><p className="text-sm font-semibold text-slate-800">Belum ada tes yang ditugaskan</p><p className="mt-1 text-xs text-slate-600">Tes muncul di sini setelah tim seleksi memberikannya.</p></div>}
            {results.length ? <section aria-label="Hasil seleksi" className="space-y-2 border-t border-slate-200 pt-4"><h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><CheckCircle2 size={17} aria-hidden="true" />Hasil seleksi</h3>{results.map((result) => <article key={result.decision_id} className={"rounded-xl border p-3.5 " + statusColor(result.result)}><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{displayStatus(result.result)}</strong><span className="text-sm font-semibold tabular-nums text-slate-800">{result.final_score == null ? "Tanpa nilai" : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(result.final_score) + " / 100"}</span></div>{result.public_note ? <p className="mt-1 break-words text-sm leading-6">{result.public_note}</p> : null}</article>)}</section> : null}
          </div>
        </div>
        <aside className="min-w-0 space-y-4"><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5 sm:px-5"><div className="flex items-center gap-2.5"><span className="flex size-9 items-center justify-center rounded-lg bg-sky-50 text-sky-800"><BookOpen size={18} aria-hidden="true" /></span><div><h3 className="text-sm font-bold text-slate-900">Materi persiapan</h3><p className="text-xs text-slate-500">Baca sebelum mulai</p></div></div><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{materials.length}</span></div><div className="p-3 sm:p-4">{materials.length ? <div className="divide-y divide-slate-200">{materials.map((material, index) => { const content = material.content as { body?: string } | null; return <details key={material.id} className="group py-2 first:pt-0 last:pb-0"><summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"><span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] tabular-nums text-slate-600">{String(index + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1 break-words">{material.title}</span><span aria-hidden="true" className="text-lg text-slate-400 group-open:rotate-45">+</span></summary><p className="whitespace-pre-wrap break-words px-2 pb-2 pl-11 text-sm leading-6 text-slate-600">{content?.body || "Materi ini belum memiliki isi."}</p></details>; })}</div> : <div className="px-2 py-5 text-center"><p className="text-sm font-semibold text-slate-800">Materi belum tersedia</p><p className="mt-1 text-xs text-slate-600">Materi akan muncul setelah diterbitkan.</p></div>}</div></section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h3 className="text-sm font-bold text-slate-900">Sebelum mulai</h3><ul className="mt-3 space-y-2 text-xs leading-5 text-slate-600"><li className="flex gap-2"><CheckCircle2 size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-700" />Baca instruksi dan batas waktu tes.</li><li className="flex gap-2"><CheckCircle2 size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-700" />Pastikan koneksi internet stabil.</li><li className="flex gap-2"><CheckCircle2 size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-700" />Jawaban esai diperiksa oleh tim seleksi.</li></ul></section></aside>
      </section>;
    })}</div> : <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center"><h2 className="text-base font-bold text-slate-900">Data pendaftaran belum tersedia</h2><p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-slate-600">Informasi seleksi muncul setelah pendaftaran Anda tercatat.</p><Link href="/dashboard/applicant" className="button-secondary mt-4">Lihat status pendaftaran <ArrowUpRight size={16} aria-hidden="true" /></Link></section>}
  </main>;
}
