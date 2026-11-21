import Link from "next/link";
import { requireAdmin } from "@/features/auth/guards";
import {
  assignSelectionTestAction, createSelectionMaterialAction,
  createSelectionTrackAction, decideSelectionAction,
  gradeSelectionAnswerAction,
  publishSelectionMaterialAction,
} from "@/features/selection/actions";
import { getSelectionWorkspace } from "@/features/selection/queries";
import { SelectionTestStudio } from "@/features/selection/SelectionTestStudio";
import { SelectionStages } from "@/features/selection/SelectionStages";

const field = "form-input w-full";
const primaryButton = "button-primary min-h-11 text-sm";
const secondaryButton = "button-secondary min-h-10 text-sm";
function StepHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">{number}</span>
    <div><h2 className="text-base font-bold tracking-tight text-slate-950 sm:text-lg">{title}</h2><p className="mt-0.5 text-xs leading-5 text-slate-600 sm:text-sm">{description}</p></div>
  </div>;
}

export default async function MentorSelectionPage() {
  await requireAdmin();
  const workspace = await getSelectionWorkspace();
  const publishedTests = workspace.tests.filter((test) => test.is_published);
  const awaitingReview = workspace.assignments.filter((assignment) =>
    ["submitted", "grading"].includes(assignment.attempt?.status ?? "") ||
    (assignment.attempt?.status === "graded" && !["passed", "failed"].includes(assignment.status))
  ).length;

  return <main className="mx-auto max-w-6xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
    <header className="border-b border-slate-200 pb-4">
      <div className="border-l-4 border-red-700 pl-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Pendaftaran / Seleksi</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Seleksi calon peserta</h1>
        <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">Atur jalur, susun tes, bagikan kepada pelamar, lalu tinjau hasilnya.</p>
      </div>
    </header>

    <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:grid-cols-4" aria-label="Ringkasan seleksi">
      {[
        { label: "Pelamar", value: workspace.applications.length, caption: "Dalam daftar seleksi" },
        { label: "Tes siap", value: publishedTests.length, caption: "Paket sudah terbit" },
        { label: "Ditugaskan", value: workspace.assignments.length, caption: "Tes terkirim" },
        { label: "Perlu ditinjau", value: awaitingReview, caption: "Jawaban atau keputusan" },
      ].map((stat, index) => <div key={stat.label} className={`min-w-0 px-3 py-2.5 sm:px-4 ${index % 2 ? "border-l border-slate-100" : ""} ${index > 1 ? "border-t border-slate-100 sm:border-t-0" : ""} ${index === 2 ? "sm:border-l" : ""}`}><p className="text-xs font-medium text-slate-600">{stat.label}</p><p className="mt-0.5 text-xl font-bold leading-7 tracking-tight text-slate-950">{stat.value}</p><p className="text-[11px] leading-4 text-slate-500">{stat.caption}</p></div>)}
    </div>

    <SelectionStages>

    <section id="jalur" className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <StepHeading number="01" title="Siapkan jalur seleksi" description="Jalur mengelompokkan tes sesuai jurusan atau kebutuhan program." />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-800">Jalur tersedia <span className="ml-1 font-normal text-slate-500">({workspace.tracks.length})</span></h3><a href="#tes" className="text-sm font-semibold text-teal-800 underline-offset-4 hover:underline">Lihat paket tes</a></div>
      {workspace.tracks.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2">{workspace.tracks.map((track) => <li key={track.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><span className="truncate text-sm font-semibold text-slate-900">{track.name}</span><span className="max-w-32 truncate rounded-md bg-white px-2 py-1 text-xs text-slate-600" title={track.code}>{track.code}</span></li>)}</ul> : <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">Belum ada jalur. Buat jalur pertama untuk memulai seleksi.</p>}
      <details className="group mt-5 rounded-xl border border-slate-200 bg-white">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">+ Tambah jalur baru<span aria-hidden="true" className="text-slate-500 group-open:rotate-180">⌄</span></summary>
        <form action={createSelectionTrackAction} className="grid gap-3 border-t border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
          <label className="form-field"><span className="form-label">Nama jalur</span><input className={field} name="name" placeholder="Contoh: Desain Grafis" required /></label>
          <label className="form-field"><span className="form-label">Kode jalur</span><input className={field} name="code" placeholder="Contoh: DESAIN_GRAFIS" required /></label>
          <label className="form-field sm:col-span-2"><span className="form-label">Keterangan (opsional)</span><textarea className={field} name="description" rows={2} /></label>
          <button className={`${primaryButton} justify-self-start sm:col-span-2`}>Buat jalur</button>
        </form>
      </details>
      <details className="mt-5 rounded-xl border border-slate-200">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">Materi persiapan (opsional)</summary>
        <div className="grid gap-5 border-t border-slate-200 p-4 lg:grid-cols-2">
          <form action={createSelectionMaterialAction} className="grid gap-3">
            <label className="form-field"><span className="form-label">Jalur</span><select className={field} name="trackId" required><option value="">Pilih jalur</option>{workspace.tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}</select></label>
            <label className="form-field"><span className="form-label">Judul materi</span><input className={field} name="title" required /></label>
            <label className="form-field"><span className="form-label">Isi materi</span><textarea className={field} name="content" rows={3} /></label>
            <input type="hidden" name="orderIndex" value="0" />
            <button className={`${secondaryButton} justify-self-start`}>Simpan materi</button>
          </form>
          <ul className="divide-y divide-slate-100">{workspace.materials.map((material) => <li key={material.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>{material.title}</span>{material.is_published ? <span className="text-xs font-semibold text-teal-700">Terbit</span> : <form action={publishSelectionMaterialAction}><input type="hidden" name="materialId" value={material.id} /><button className={secondaryButton}>Terbitkan</button></form>}</li>)}</ul>
        </div>
      </details>
    </section>

    <SelectionTestStudio tracks={workspace.tracks} tests={workspace.tests} questions={workspace.questions} />

    <section id="penugasan" className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <StepHeading number="03" title="Tugaskan tes ke pelamar" description="Hanya paket tes berstatus Terbit yang dapat dipilih. Batas waktu boleh dikosongkan." />
      {publishedTests.length && workspace.applications.length ? <form action={assignSelectionTestAction} className="mt-5 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
        <label className="form-field"><span className="form-label">Calon peserta</span><select className={field} name="applicationId" required><option value="">Pilih pelamar</option>{workspace.applications.map((applicant) => <option key={applicant.id} value={applicant.id}>{applicant.full_name} · {applicant.email}</option>)}</select></label>
        <label className="form-field"><span className="form-label">Paket tes</span><select className={field} name="testId" required><option value="">Pilih tes terbit</option>{publishedTests.map((test) => <option key={test.id} value={test.id}>{test.title} (v{test.version})</option>)}</select></label>
        <label className="form-field"><span className="form-label">Batas waktu (opsional)</span><input className={field} name="dueAt" type="datetime-local" /></label>
        <button className={primaryButton}>Tugaskan tes</button>
      </form> : <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">{!publishedTests.length ? "Terbitkan paket tes yang sudah memiliki soal terlebih dahulu." : "Belum ada pelamar yang dapat dipilih."}</p>}
      <p className="mt-3 text-xs text-slate-500">Setelah ditugaskan, tes muncul pada menu <strong>Tes Seleksi</strong> di dashboard pelamar.</p>
    </section>

    <section id="review" className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <StepHeading number="04" title="Nilai jawaban dan tetapkan hasil" description="Periksa respons pelamar. Keputusan baru dapat disimpan setelah percobaan selesai dinilai." />
      {workspace.assignments.length ? <div className="mt-5 space-y-3">{workspace.assignments.map((assignment) => {
        const graded = assignment.attempt?.status === "graded" && assignment.attempt.final_score !== null;
        return <details key={assignment.id} className="group rounded-xl border border-slate-200">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
            <span><strong className="block text-sm text-slate-950">{assignment.applicant?.full_name ?? assignment.application_id}</strong><span className="mt-1 block text-xs text-slate-600">{assignment.test?.title ?? "Paket tes"} · {assignment.attempt?.status ?? "Belum dimulai"}</span></span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${graded ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-800"}`}>{graded ? `Nilai ${assignment.attempt?.final_score}` : assignment.status.replaceAll("_", " ")}</span>
          </summary>
          <div className="space-y-4 border-t border-slate-200 p-4">
            {assignment.attempt?.answers.length ? assignment.attempt.answers.map((answer) => <article key={answer.id} className="rounded-lg bg-slate-50 p-4">
              <h4 className="text-sm font-semibold text-slate-900">{answer.question?.prompt ?? "Pertanyaan"}</h4>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{answer.answer_text || answer.attachment_path || "Tidak ada jawaban tertulis."}</p>
              {["submitted", "grading", "graded"].includes(assignment.attempt?.status ?? "") ? <form action={gradeSelectionAnswerAction} className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-200 pt-3">
                <input type="hidden" name="answerId" value={answer.id} /><input type="hidden" name="assignmentId" value={assignment.id} /><input type="hidden" name="maxPoints" value={answer.question?.points ?? 0} />
                <label className="form-field"><span className="form-label">Nilai (maks. {answer.question?.points ?? 0})</span><input className={field} type="number" name="awardedPoints" min="0" max={answer.question?.points ?? 0} defaultValue={answer.manual_score ?? ""} required /></label>
                <label className="form-field min-w-56 flex-1"><span className="form-label">Umpan balik (opsional)</span><input className={field} name="feedback" defaultValue={answer.feedback ?? ""} /></label>
                <button className={secondaryButton}>Simpan nilai</button>
              </form> : null}
            </article>) : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Pelamar belum mengirim jawaban tes.</p>}
            {graded ? <form action={decideSelectionAction} className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4">
              <input type="hidden" name="assignmentId" value={assignment.id} /><input type="hidden" name="applicationId" value={assignment.application_id} />
              <label className="form-field"><span className="form-label">Keputusan</span><select className={field} name="decision"><option value="passed">Lulus</option><option value="failed">Tidak lulus</option><option value="waitlisted">Daftar tunggu</option></select></label>
              <label className="form-field min-w-56 flex-1"><span className="form-label">Catatan</span><input className={field} name="notes" /></label>
              <button className={primaryButton}>Simpan keputusan</button>
            </form> : <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-950">Keputusan tersedia setelah tes selesai dan seluruh penilaian manual tersimpan.</p>}
          </div>
        </details>;
      })}</div> : <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">Belum ada tes yang ditugaskan kepada pelamar.</p>}
      <p className="mt-4 text-sm text-slate-600">Setelah status <strong>Lulus</strong>, kembali ke <Link href="/dashboard/admin/pendaftaran" className="font-semibold text-teal-800 underline underline-offset-2">Pendaftaran Masuk</Link> untuk memasukkan periode magang dan menerima pelamar.</p>
    </section>
    </SelectionStages>
  </main>;
}
