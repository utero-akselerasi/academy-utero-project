import { AssignSelectionForm } from "@/features/selection/AssignSelectionForm";
import Link from "next/link";
import { ArrowRight, BookOpen, ClipboardCheck, Eye, Layers, Monitor, Plus, Users } from "lucide-react";
import { requireAdmin } from "@/features/auth/guards";
import {
  createSelectionMaterialAction,
  createSelectionTrackAction,
  publishSelectionMaterialAction,
} from "@/features/selection/actions";
import { getSelectionWorkspace } from "@/features/selection/queries";
import { SelectionTestStudio } from "@/features/selection/SelectionTestStudio";
import { SelectionStages } from "@/features/selection/SelectionStages";
import { reviewDuration, reviewStatus, reviewTime } from "@/features/selection/review-display";

const field = "form-input w-full";
const primaryButton = "button-primary min-h-11 text-sm";
const secondaryButton = "button-secondary min-h-10 text-sm";
function StepHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-800 text-xs font-bold text-white shadow-sm">{number}</span>
    <div><h2 className="text-base font-bold tracking-tight text-slate-950 sm:text-lg">{title}</h2><p className="mt-0.5 text-xs leading-5 text-slate-600 sm:text-sm">{description}</p></div>
  </div>;
}

export default async function MentorSelectionPage() {
  await requireAdmin();
  const workspace = await getSelectionWorkspace();
  const publishedTests = workspace.tests.filter((test) => test.is_published && test.is_active);
  const eligibleApplications = workspace.applications.filter((application) => !["accepted", "converted", "rejected", "cancelled"].includes(application.status));
  const awaitingReview = workspace.assignments.filter((assignment) =>
    ["submitted", "grading"].includes(assignment.attempt?.status ?? "") ||
    (assignment.attempt?.status === "graded" && !["passed", "failed", "waitlisted"].includes(assignment.status))
  ).length;
  const nextStep = !workspace.tracks.length
    ? { href: "#jalur", label: "Buat jalur seleksi", description: "Mulai dengan jalur untuk mengelompokkan paket tes." }
    : !workspace.tests.length || !publishedTests.length
      ? { href: "#tes", label: "Siapkan paket tes", description: "Susun soal dan terbitkan paket sebelum membagikannya." }
      : awaitingReview
        ? { href: "#review", label: "Tinjau hasil pelamar", description: `${awaitingReview} penugasan menunggu penilaian atau keputusan.` }
        : { href: "#penugasan", label: "Bagikan tes ke pelamar", description: "Pilih peserta dan paket terbit untuk memulai seleksi." };
  const reviewAssignments = [...workspace.assignments].sort((first, second) => {
    const needsReview = (assignment: typeof first) => ["submitted", "grading"].includes(assignment.attempt?.status ?? "") ||
      (assignment.attempt?.status === "graded" && !["passed", "failed", "waitlisted"].includes(assignment.status));
    return Number(needsReview(second)) - Number(needsReview(first));
  });

  return <main className="selection-workspace w-full space-y-3 px-3 py-3 sm:px-4 sm:py-4">
    <header className="relative isolate overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-white to-teal-50 px-3 py-3 shadow-sm sm:px-4">
      <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-16 size-48 rounded-full bg-teal-100/70 blur-3xl" />
      <div className="relative flex items-center gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-800 text-white shadow-sm sm:size-14"><Users size={26} aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-teal-800">Pendaftaran / Seleksi</p>
          <h1 className="mt-0.5 text-lg font-bold tracking-tight text-slate-950 sm:text-xl">Seleksi calon peserta</h1>
          <p className="mt-1 text-sm leading-5 text-slate-600">Atur jalur, susun tes, bagikan kepada pelamar, lalu tinjau hasilnya.</p>
        </div>
      </div>
    </header>

    <section aria-label="Ringkasan seleksi" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[
        { label: "Pelamar", value: eligibleApplications.length, detail: "Dapat ditugaskan", Icon: Users, tone: "bg-violet-50 text-violet-700" },
        { label: "Tes siap", value: publishedTests.length, detail: "Paket terbit", Icon: ClipboardCheck, tone: "bg-amber-50 text-amber-700" },
        { label: "Ditugaskan", value: workspace.assignments.length, detail: "Tes dibagikan", Icon: Monitor, tone: "bg-slate-100 text-slate-700" },
        { label: "Perlu ditinjau", value: awaitingReview, detail: "Menunggu tindakan", Icon: Eye, tone: "bg-rose-50 text-rose-700" },
      ].map(({ label, value, detail, Icon, tone }) => <article key={label} className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon size={18} aria-hidden="true" /></span>
        <div className="min-w-0"><p className="text-xs font-medium text-slate-600">{label}</p><p className="mt-0.5 text-xl font-bold leading-6 tabular-nums text-slate-950">{value}</p><p className="mt-0.5 text-xs text-slate-500">{detail}</p></div>
      </article>)}
    </section>

    <aside className="flex flex-wrap items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 sm:flex-nowrap" aria-label="Langkah berikut">
      <span className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-white text-teal-700 sm:flex"><ClipboardCheck size={20} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-bold text-teal-950">Langkah berikut: {nextStep.label}</p><p className="text-xs leading-5 text-teal-900">{nextStep.description}</p></div>
      <a href={nextStep.href} className="button-primary min-h-11 shrink-0 text-sm">Buka tahap <ArrowRight size={16} aria-hidden="true" /></a>
    </aside>
    <SelectionStages>

    <section id="jalur" className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <StepHeading number="01" title="Siapkan jalur seleksi" description="Kelompokkan tes berdasarkan jurusan atau kebutuhan program." />
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-slate-900">Jalur tersedia <span className="font-medium text-slate-500">({workspace.tracks.length})</span></h3><a href="#tes" className="min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Lihat paket tes</a></div>
          {workspace.tracks.length ? <ul className="mt-2 grid gap-2">{workspace.tracks.map((track) => <li key={track.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3"><span className="flex min-w-0 items-center gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><Layers size={16} aria-hidden="true" /></span><span className="truncate text-sm font-semibold text-slate-900">{track.name}</span></span><span className="max-w-32 shrink-0 truncate rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600" title={track.code}>{track.code}</span></li>)}</ul> : <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">Belum ada jalur. Buat jalur pertama untuk memulai seleksi.</p>}
        </div>
        <details open className="group min-w-0 overflow-hidden rounded-xl border border-teal-200 bg-white">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 bg-teal-50/70 px-3 py-2.5 text-sm font-bold text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"><Plus size={17} aria-hidden="true" /> Tambah jalur baru</summary>
          <form action={createSelectionTrackAction} className="grid gap-3 border-t border-slate-200 p-3 sm:grid-cols-2 sm:p-4">
            <label className="form-field"><span className="form-label">Nama jalur</span><input className={field} name="name" placeholder="Contoh: Desain Grafis" required /></label>
            <label className="form-field"><span className="form-label">Kode jalur</span><input className={field} name="code" placeholder="Contoh: DESAIN_GRAFIS" required /></label>
            <label className="form-field sm:col-span-2"><span className="form-label">Keterangan (opsional)</span><textarea className={field} name="description" rows={2} placeholder="Jelaskan singkat tujuan atau cakupan jalur ini..." /></label>
            <button className={`${primaryButton} justify-self-start sm:col-span-2`}><Plus size={16} aria-hidden="true" /> Buat jalur</button>
          </form>
        </details>
      </div>
      <details className="group mt-4 overflow-hidden rounded-xl border border-slate-200">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"><BookOpen size={16} className="text-teal-700" aria-hidden="true" /> Materi persiapan <span className="font-normal text-slate-500">(opsional)</span><span aria-hidden="true" className="ml-auto text-slate-500 group-open:rotate-180">⌄</span></summary>
        <div className="grid gap-4 border-t border-slate-200 p-3 sm:p-4 lg:grid-cols-2">
          <form action={createSelectionMaterialAction} className="grid content-start gap-3">
            <label className="form-field"><span className="form-label">Jalur</span><select className={field} name="trackId" required><option value="">Pilih jalur</option>{workspace.tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}</select></label>
            <label className="form-field"><span className="form-label">Judul materi</span><input className={field} name="title" placeholder="Contoh: Pengenalan Dasar IT" required /></label>
            <label className="form-field"><span className="form-label">Isi materi</span><textarea className={field} name="content" rows={3} placeholder="Tuliskan materi, tautan referensi, atau instruksi..." /></label>
            <input type="hidden" name="orderIndex" value="0" />
            <button className={`${secondaryButton} justify-self-start`}>Simpan materi</button>
          </form>
          <ul className="divide-y divide-slate-100">{workspace.materials.length ? workspace.materials.map((material) => <li key={material.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span className="font-medium text-slate-800">{material.title}</span>{material.is_published ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Terbit</span> : <form action={publishSelectionMaterialAction}><input type="hidden" name="materialId" value={material.id} /><button className={secondaryButton}>Terbitkan</button></form>}</li>) : <li className="py-3 text-sm text-slate-500">Belum ada materi persiapan.</li>}</ul>
        </div>
      </details>
    </section>
    <SelectionTestStudio tracks={workspace.tracks} tests={workspace.tests} questions={workspace.questions} />

    <section id="penugasan" className="scroll-mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <StepHeading number="03" title="Tugaskan tes ke pelamar" description="Hanya paket tes berstatus Terbit yang dapat dipilih. Batas waktu boleh dikosongkan." />
      {publishedTests.length && eligibleApplications.length ? <AssignSelectionForm applications={eligibleApplications} tests={publishedTests} /> : <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">{!publishedTests.length ? "Terbitkan paket tes yang sudah memiliki soal terlebih dahulu." : "Tidak ada pelamar aktif yang dapat ditugaskan. Peserta diterima atau pendaftaran ditutup tidak ditampilkan."}</p>}
      <p className="mt-3 text-xs text-slate-500">Setelah ditugaskan, tes muncul pada menu <strong>Tes Seleksi</strong> di dashboard pelamar.</p>
    </section>

    <section id="review" className="scroll-mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <StepHeading number="04" title="Nilai jawaban dan tetapkan hasil" description="Periksa respons pelamar. Keputusan baru dapat disimpan setelah percobaan selesai dinilai." />
      {workspace.assignments.length ? <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">Pelamar</th><th className="px-4 py-3">Paket tes</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Mulai / dikirim</th><th className="px-4 py-3">Durasi</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead>
          <tbody className="divide-y divide-slate-100 bg-white">{reviewAssignments.map((assignment) => {
            const status = reviewStatus(assignment, workspace.currentTime);
            return <tr key={assignment.id} className="align-middle hover:bg-slate-50/70">
              <td className="px-4 py-3"><span className="block font-semibold text-slate-950">{assignment.applicant?.full_name ?? assignment.application_id}</span><span className="text-xs text-slate-500">{assignment.applicant?.email ?? ""}</span></td>
              <td className="px-4 py-3 text-slate-700">{assignment.test?.title ?? "Paket tes"}</td>
              <td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${status.tone}`}>{status.label}</span>{assignment.attempt?.final_score !== null && assignment.attempt?.final_score !== undefined ? <span className="ml-2 text-xs text-slate-500">Nilai {assignment.attempt.final_score}</span> : null}</td>
              <td className="px-4 py-3 text-xs leading-5 text-slate-600"><span className="block">Mulai: {reviewTime(assignment.attempt?.started_at)}</span><span className="block">Kirim: {reviewTime(assignment.attempt?.submitted_at)}</span></td>
              <td className="px-4 py-3 text-slate-700">{reviewDuration(assignment, workspace.currentTime)}</td>
              <td className="px-4 py-3 text-right"><Link className="button-secondary inline-flex min-h-9 items-center gap-1.5 px-3 text-xs" href={`/dashboard/mentor/selection/review/${assignment.id}`}><Eye size={14} aria-hidden="true" /> Lihat & review</Link></td>
            </tr>;
          })}</tbody>
        </table></div>
      </div> : <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">Belum ada tes yang ditugaskan kepada pelamar.</p>}
      <p className="mt-4 text-sm text-slate-600">Setelah status <strong>Lulus</strong>, kembali ke <Link href="/dashboard/admin/pendaftaran" className="font-semibold text-teal-800 underline underline-offset-2">Pendaftaran Masuk</Link> untuk memasukkan periode magang dan menerima pelamar.</p>
    </section>
    </SelectionStages>
  </main>;
}
