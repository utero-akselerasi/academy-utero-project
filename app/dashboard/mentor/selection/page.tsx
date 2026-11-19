import Link from "next/link";
import { requireAdmin } from "@/features/auth/guards";
import {
  assignSelectionTestAction, createSelectionMaterialAction, createSelectionQuestionAction,
  createSelectionTestAction, createSelectionTrackAction, decideSelectionAction,
  gradeSelectionAnswerAction, publishSelectionTestAction, versionSelectionTestAction,
  publishSelectionMaterialAction,
} from "@/features/selection/actions";
import { getSelectionWorkspace } from "@/features/selection/queries";
import { selectionQuestionTypes } from "@/features/selection/types";

const field = "form-input w-full";
const primaryButton = "button-primary min-h-11 text-sm";
const secondaryButton = "button-secondary min-h-10 text-sm";
const questionTypeLabels = {
  multiple_choice: "Pilihan ganda",
  true_false: "Benar / salah",
  short_answer: "Isian singkat",
  essay: "Esai",
  file_upload: "Unggah berkas",
} as const;
const steps = [
  { id: "jalur", number: "01", title: "Siapkan jalur" },
  { id: "tes", number: "02", title: "Buat paket & soal" },
  { id: "penugasan", number: "03", title: "Tugaskan tes" },
  { id: "review", number: "04", title: "Nilai & putuskan" },
];

function StepHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="flex items-start gap-4">
    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-sm font-extrabold text-teal-800">{number}</span>
    <div><h2 className="text-lg font-bold text-slate-950">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{description}</p></div>
  </div>;
}

export default async function MentorSelectionPage() {
  await requireAdmin();
  const workspace = await getSelectionWorkspace();
  const publishedTests = workspace.tests.filter((test) => test.is_published);
  const draftTests = workspace.tests.filter((test) => !test.is_published);
  const questionsByTest = new Map(workspace.tests.map((test) => [
    test.id,
    workspace.questions.filter((question) => question.package_id === test.id),
  ]));

  return <main className="mx-auto max-w-6xl space-y-7 px-4 py-8">
    <header className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-300">Ruang kerja admin</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
        <div><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Seleksi calon peserta</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Siapkan tes, berikan kepada pelamar, lalu nilai hasilnya dalam satu alur.</p></div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full border border-white/20 px-3 py-2">{workspace.applications.length} pelamar</span><span className="rounded-full border border-white/20 px-3 py-2">{publishedTests.length} tes terbit</span><span className="rounded-full border border-white/20 px-3 py-2">{workspace.assignments.length} penugasan</span></div>
      </div>
    </header>

    <nav aria-label="Tahapan seleksi" className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step) => <a key={step.id} href={`#${step.id}`} className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-teal-50 hover:text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"><span className="text-xs font-extrabold text-teal-700">{step.number}</span>{step.title}</a>)}
    </nav>

    <section id="jalur" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <StepHeading number="01" title="Siapkan jalur seleksi" description="Jalur mengelompokkan tes sesuai jurusan atau kebutuhan program." />
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)]">
        <form action={createSelectionTrackAction} className="grid content-start gap-3 rounded-xl bg-slate-50 p-4">
          <label className="form-field"><span className="form-label">Nama jalur</span><input className={field} name="name" placeholder="Contoh: Desain Grafis" required /></label>
          <label className="form-field"><span className="form-label">Kode jalur</span><input className={field} name="code" placeholder="Contoh: DESAIN_GRAFIS" required /></label>
          <label className="form-field"><span className="form-label">Keterangan (opsional)</span><textarea className={field} name="description" rows={2} /></label>
          <button className={`${primaryButton} justify-self-start`}>Buat jalur</button>
        </form>
        <div><h3 className="text-sm font-bold text-slate-800">Jalur tersedia</h3>{workspace.tracks.length ? <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">{workspace.tracks.map((track) => <li key={track.id} className="flex items-center justify-between gap-3 px-4 py-3"><span className="font-semibold text-slate-800">{track.name}</span><span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{track.code}</span></li>)}</ul> : <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">Buat jalur pertama sebelum menyusun tes.</p>}</div>
      </div>
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

    <section id="tes" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <StepHeading number="02" title="Buat paket tes dan soal" description="Buat paket sebagai draf, tambahkan minimal satu soal, lalu terbitkan agar bisa ditugaskan." />
      <div className="mt-5 grid gap-6 xl:grid-cols-2">
        <form action={createSelectionTestAction} className="grid content-start gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
          <label className="form-field sm:col-span-2"><span className="form-label">Jalur tes</span><select className={field} name="trackId" required><option value="">Pilih jalur</option>{workspace.tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}</select></label>
          <label className="form-field"><span className="form-label">Kode paket</span><input className={field} name="code" placeholder="TES_DESAIN" required /></label>
          <label className="form-field"><span className="form-label">Nama tes</span><input className={field} name="title" placeholder="Tes dasar desain" required /></label>
          <label className="form-field sm:col-span-2"><span className="form-label">Petunjuk untuk peserta</span><textarea className={field} name="description" rows={2} /></label>
          <label className="form-field"><span className="form-label">Ambang lulus (%)</span><input className={field} name="passingScore" type="number" min="0" max="100" defaultValue="70" required /></label>
          <label className="form-field"><span className="form-label">Durasi (menit)</span><input className={field} name="durationMinutes" type="number" min="1" max="480" defaultValue="60" required /></label>
          <label className="form-field"><span className="form-label">Kesempatan tes</span><input className={field} name="maxAttempts" type="number" min="1" max="10" defaultValue="1" required /></label>
          <button className={`${primaryButton} justify-self-start sm:col-span-2`}>Simpan sebagai draf</button>
        </form>

        <div><h3 className="text-sm font-bold text-slate-800">Paket dan bank soal</h3>{workspace.tests.length ? <div className="mt-3 space-y-3">{workspace.tests.map((test) => {
          const questions = questionsByTest.get(test.id) ?? [];
          return <article key={test.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-bold text-slate-950">{test.title}</h4><p className="mt-1 text-xs text-slate-600">{test.code} · v{test.version} · {questions.length} soal · lulus {test.passing_score}%</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${test.is_published ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-800"}`}>{test.is_published ? "Terbit" : "Draf"}</span></div>
            {questions.length ? <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-700">{questions.map((question) => <li key={question.id} className="flex justify-between gap-3"><span className="line-clamp-2">{question.prompt.text}</span><span className="shrink-0 text-xs text-slate-500">{question.points} poin</span></li>)}</ul> : <p className="mt-3 text-xs text-amber-800">Tambahkan soal sebelum menerbitkan paket ini.</p>}
            <div className="mt-3 flex flex-wrap gap-2">{!test.is_published && questions.length > 0 ? <form action={publishSelectionTestAction}><input type="hidden" name="testId" value={test.id} /><button className={secondaryButton}>Terbitkan tes</button></form> : null}{test.is_published ? <form action={versionSelectionTestAction}><input type="hidden" name="testId" value={test.id} /><button className={secondaryButton}>Buat versi baru</button></form> : null}</div>
          </article>;
        })}</div> : <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">Belum ada paket tes. Buat draf pertama di formulir.</p>}</div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 p-4">
        <h3 className="font-bold text-slate-950">Tambah soal ke paket draf</h3>
        <p className="mt-1 text-sm text-slate-600">Paket yang sudah terbit tidak dapat diubah; buat versi baru untuk memperbarui isi tes.</p>
        {draftTests.length ? <form action={createSelectionQuestionAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="form-field sm:col-span-2"><span className="form-label">Paket tes</span><select className={field} name="testId" required><option value="">Pilih paket draf</option>{draftTests.map((test) => <option key={test.id} value={test.id}>{test.title} v{test.version}</option>)}</select></label>
          <label className="form-field sm:col-span-2"><span className="form-label">Pertanyaan</span><textarea className={field} name="prompt" rows={3} placeholder="Tulis pertanyaan dengan jelas" required /></label>
          <label className="form-field"><span className="form-label">Jenis soal</span><select className={field} name="type">{selectionQuestionTypes.map((type) => <option key={type} value={type}>{questionTypeLabels[type]}</option>)}</select></label>
          <label className="form-field"><span className="form-label">Bobot poin</span><input className={field} name="points" type="number" min="1" defaultValue="10" required /></label>
          <label className="form-field"><span className="form-label">Urutan soal</span><input className={field} name="orderIndex" type="number" min="0" defaultValue="0" /></label>
          <details className="rounded-lg border border-slate-200 sm:col-span-2"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">Opsi dan kunci jawaban (jika diperlukan)</summary>
            <div className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-2">
              <label className="form-field"><span className="form-label">Opsi pilihan ganda (satu per baris)</span><textarea className={field} name="options" rows={3} /></label>
              <label className="form-field"><span className="form-label">Jawaban benar (pilihan ganda / benar-salah)</span><input className={field} name="correctOption" placeholder="Sama persis dengan teks opsi" /></label>
              <label className="form-field sm:col-span-2"><span className="form-label">Kunci jawaban singkat (opsional)</span><input className={field} name="expectedAnswer" /></label>
            </div>
          </details>
          <p className="sm:col-span-2 text-xs leading-5 text-slate-500">Untuk soal esai atau unggah berkas, penilaian dilakukan manual setelah peserta mengirim jawaban.</p>
          <button className={`${primaryButton} justify-self-start sm:col-span-2`}>Simpan soal</button>
        </form> : <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Buat paket tes draf terlebih dahulu untuk menambahkan soal.</p>}
      </div>
    </section>

    <section id="penugasan" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <StepHeading number="03" title="Tugaskan tes ke pelamar" description="Hanya paket tes berstatus Terbit yang dapat dipilih. Batas waktu boleh dikosongkan." />
      {publishedTests.length && workspace.applications.length ? <form action={assignSelectionTestAction} className="mt-5 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
        <label className="form-field"><span className="form-label">Calon peserta</span><select className={field} name="applicationId" required><option value="">Pilih pelamar</option>{workspace.applications.map((applicant) => <option key={applicant.id} value={applicant.id}>{applicant.full_name} · {applicant.email}</option>)}</select></label>
        <label className="form-field"><span className="form-label">Paket tes</span><select className={field} name="testId" required><option value="">Pilih tes terbit</option>{publishedTests.map((test) => <option key={test.id} value={test.id}>{test.title} (v{test.version})</option>)}</select></label>
        <label className="form-field"><span className="form-label">Batas waktu (opsional)</span><input className={field} name="dueAt" type="datetime-local" /></label>
        <button className={primaryButton}>Tugaskan tes</button>
      </form> : <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">{!publishedTests.length ? "Terbitkan paket tes yang sudah memiliki soal terlebih dahulu." : "Belum ada pelamar yang dapat dipilih."}</p>}
      <p className="mt-3 text-xs text-slate-500">Setelah ditugaskan, tes muncul pada menu <strong>Tes Seleksi</strong> di dashboard pelamar.</p>
    </section>

    <section id="review" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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
  </main>;
}
