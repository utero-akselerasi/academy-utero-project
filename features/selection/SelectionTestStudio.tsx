"use client";

import { useState } from "react";
import {
  createSelectionQuestionAction,
  createSelectionTestAction,
  publishSelectionTestAction,
  updateSelectionQuestionAction,
  updateSelectionTestAction,
  versionSelectionTestAction,
} from "@/features/selection/actions";
import type { SelectionQuestion, SelectionQuestionType, SelectionTest, SelectionTrack } from "@/features/selection/types";

const field = "form-input w-full";
const primaryButton = "button-primary min-h-11 text-sm";
const secondaryButton = "button-secondary min-h-10 text-sm";
const types: Array<{ value: SelectionQuestionType; label: string }> = [
  { value: "multiple_choice", label: "Pilihan ganda" },
  { value: "true_false", label: "Benar / salah" },
  { value: "short_answer", label: "Isian singkat" },
  { value: "essay", label: "Esai" },
  { value: "file_upload", label: "Unggah berkas" },
];

type Props = { tracks: SelectionTrack[]; tests: SelectionTest[]; questions: SelectionQuestion[] };

function QuestionFields({ question }: { question?: SelectionQuestion }) {
  const [type, setType] = useState<SelectionQuestionType>(question?.question_type ?? "multiple_choice");
  const options = [...(question?.options ?? [])].sort((a, b) => a.order_index - b.order_index);
  return <>
    {question ? <input type="hidden" name="questionId" value={question.id} /> : null}
    <label className="form-field sm:col-span-2"><span className="form-label">Teks soal</span><textarea className={field} name="prompt" rows={3} defaultValue={question?.prompt.text ?? ""} placeholder="Tulis pertanyaan dengan jelas" required /></label>
    <label className="form-field"><span className="form-label">Jenis soal</span><select className={field} name="type" value={type} onChange={(event) => setType(event.target.value as SelectionQuestionType)}>{types.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label className="form-field"><span className="form-label">Poin</span><input className={field} name="points" type="number" min="1" max="1000" defaultValue={question?.points ?? 10} required /></label>
    <label className="form-field"><span className="form-label">Urutan</span><input className={field} name="orderIndex" type="number" min="0" defaultValue={question?.order_index ?? 0} /></label>
    {type === "multiple_choice" ? <>
      <label className="form-field sm:col-span-2"><span className="form-label">Opsi jawaban, satu per baris</span><textarea className={field} name="options" rows={3} defaultValue={options.map((option) => option.label).join("\n")} placeholder="A\nB\nC" required /></label>
      <label className="form-field sm:col-span-2"><span className="form-label">Jawaban benar</span><input className={field} name="correctOption" defaultValue={options.find((option) => option.is_correct)?.label ?? ""} placeholder="Harus sama dengan salah satu opsi" required /></label>
    </> : null}
    {type === "true_false" ? <label className="form-field sm:col-span-2"><span className="form-label">Jawaban benar</span><select className={field} name="correctOption" defaultValue={options.find((option) => option.is_correct)?.label ?? ""} required><option value="" disabled>Pilih jawaban</option><option value="Benar">Benar</option><option value="Salah">Salah</option></select></label> : null}
    {type === "short_answer" ? <label className="form-field sm:col-span-2"><span className="form-label">Kunci jawaban singkat (opsional)</span><input className={field} name="expectedAnswer" defaultValue={question?.answer_key?.value ?? ""} /></label> : null}
    {["essay", "file_upload"].includes(type) ? <p className="sm:col-span-2 text-xs text-slate-600">Jawaban peserta dinilai secara manual setelah tes dikirim.</p> : null}
  </>;
}
export function SelectionTestStudio({ tracks, tests, questions }: Props) {
  const sortedTests = [...tests].sort((first, second) => Number(first.is_published) - Number(second.is_published) || first.title.localeCompare(second.title, "id"));
  const [selectedId, setSelectedId] = useState(sortedTests[0]?.id ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [packageEditOpen, setPackageEditOpen] = useState(false);
  const [questionEditId, setQuestionEditId] = useState("");
  const [addingQuestion, setAddingQuestion] = useState(false);
  const selected = sortedTests.find((test) => test.id === selectedId) ?? sortedTests[0];
  const packageQuestions = questions.filter((question) => question.package_id === selected?.id).sort((a, b) => a.order_index - b.order_index);
  const draftCount = tests.filter((test) => !test.is_published).length;
  const publishedCount = tests.length - draftCount;

  return <section id="tes" className="scroll-mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
      <div><p className="text-xs font-bold uppercase tracking-wide text-teal-800">Tahap 2 · Rancang tes</p><h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Paket tes dan soal</h2><p className="mt-1 max-w-2xl text-sm leading-5 text-slate-600">Pilih paket untuk mengelola pengaturan dan soal. Terbitkan setelah siap ditugaskan.</p></div>
      <button type="button" onClick={() => setCreateOpen(!createOpen)} aria-expanded={createOpen} className={primaryButton}>{createOpen ? "Tutup formulir" : "+ Paket baru"}</button>
    </header>

    {createOpen ? <form action={createSelectionTestAction} className="grid gap-3 rounded-xl border border-teal-200 bg-teal-50/40 p-4 sm:grid-cols-2"><h3 className="text-sm font-bold text-slate-900 sm:col-span-2">Buat paket tes</h3><label className="form-field"><span className="form-label">Jalur seleksi</span><select className={field} name="trackId" required defaultValue=""><option value="" disabled>Pilih jalur</option>{tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}</select></label><label className="form-field"><span className="form-label">Kode paket</span><input className={field} name="code" placeholder="FUNDAMENTAL_IT" required /></label><label className="form-field sm:col-span-2"><span className="form-label">Nama tes</span><input className={field} name="title" placeholder="Tes Dasar Fundamental IT" required /></label><label className="form-field sm:col-span-2"><span className="form-label">Petunjuk peserta</span><textarea className={field} name="description" rows={2} /></label><label className="form-field"><span className="form-label">Nilai lulus (%)</span><input className={field} name="passingScore" type="number" min="0" max="100" defaultValue="70" required /></label><label className="form-field"><span className="form-label">Durasi (menit)</span><input className={field} name="durationMinutes" type="number" min="1" max="480" defaultValue="60" required /></label><label className="form-field"><span className="form-label">Kesempatan</span><input className={field} name="maxAttempts" type="number" min="1" max="10" defaultValue="1" required /></label><button className={`${primaryButton} justify-self-start sm:col-span-2`}>Simpan draf</button></form> : null}

    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,2fr)]">
      <aside className="min-w-0 overflow-hidden rounded-xl border border-slate-200" aria-label="Daftar paket tes">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-3"><h3 className="text-sm font-bold text-slate-900">Paket</h3><span className="text-xs text-slate-500">{tests.length} total</span></div>
        <div className="flex gap-2 border-b border-slate-100 px-3 py-2 text-[11px] font-medium text-slate-600"><span>{draftCount} draf</span><span aria-hidden="true">·</span><span>{publishedCount} terbit</span></div>
        {tests.length ? <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">{sortedTests.map((test) => {
          const count = questions.filter((question) => question.package_id === test.id).length;
          return <li key={test.id}><button type="button" onClick={() => { setSelectedId(test.id); setPackageEditOpen(false); setQuestionEditId(""); setAddingQuestion(false); }} aria-pressed={selected?.id === test.id} className={`w-full min-h-16 px-3 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-teal-700 ${selected?.id === test.id ? "bg-teal-50" : "hover:bg-slate-50"}`}><span className="flex items-start justify-between gap-2"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900">{test.title}</span><span className="mt-1 block truncate text-xs text-slate-500">{test.code} · v{test.version} · {count} soal</span></span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${test.is_published ? "bg-teal-100 text-teal-900" : "bg-amber-100 text-amber-900"}`}>{test.is_published ? "Terbit" : "Draf"}</span></span></button></li>;
        })}</ul> : <p className="p-4 text-sm leading-5 text-slate-600">Belum ada paket. Tekan <strong>+ Paket baru</strong> untuk mulai.</p>}
      </aside>

      <section className="min-w-0 rounded-xl border border-slate-200" aria-label="Editor paket dan soal">
        {selected ? <>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{selected.code} · Versi {selected.version}</p><h3 className="mt-1 break-words text-lg font-bold text-slate-950">{selected.title}</h3><p className="mt-1 text-sm text-slate-600">Nilai lulus {selected.passing_score}% · {selected.duration_minutes} menit · Maks. {selected.max_attempts} kesempatan</p></div><div className="flex shrink-0 flex-wrap gap-2">{!selected.is_published ? <button type="button" onClick={() => setPackageEditOpen(!packageEditOpen)} className={secondaryButton}>{packageEditOpen ? "Tutup edit" : "Edit paket"}</button> : <form action={versionSelectionTestAction}><input type="hidden" name="testId" value={selected.id} /><button className={secondaryButton}>Buat versi baru</button></form>}</div></div>
          {packageEditOpen && !selected.is_published ? <form key={`package-${selected.id}`} action={updateSelectionTestAction} className="grid gap-3 border-b border-slate-200 bg-white p-4 sm:grid-cols-2"><input type="hidden" name="testId" value={selected.id} /><label className="form-field"><span className="form-label">Jalur seleksi</span><select className={field} name="trackId" defaultValue={selected.track_id} required>{tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}</select></label><label className="form-field"><span className="form-label">Kode paket</span><input className={field} name="code" defaultValue={selected.code} required /></label><label className="form-field sm:col-span-2"><span className="form-label">Nama tes</span><input className={field} name="title" defaultValue={selected.title} required /></label><label className="form-field sm:col-span-2"><span className="form-label">Petunjuk peserta</span><textarea className={field} name="description" defaultValue={selected.description ?? ""} rows={2} /></label><label className="form-field"><span className="form-label">Nilai lulus (%)</span><input className={field} type="number" name="passingScore" min="0" max="100" defaultValue={selected.passing_score} required /></label><label className="form-field"><span className="form-label">Durasi (menit)</span><input className={field} type="number" name="durationMinutes" min="1" max="480" defaultValue={selected.duration_minutes} required /></label><label className="form-field"><span className="form-label">Kesempatan</span><input className={field} type="number" name="maxAttempts" min="1" max="10" defaultValue={selected.max_attempts} required /></label><button className={`${primaryButton} justify-self-start sm:col-span-2`}>Simpan perubahan</button></form> : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3"><div><h4 className="text-sm font-bold text-slate-900">Soal dalam paket</h4><p className="text-xs text-slate-500">{packageQuestions.length} soal · {packageQuestions.reduce((sum, question) => sum + Number(question.points), 0)} poin total</p></div>{!selected.is_published ? <button type="button" onClick={() => { setAddingQuestion(!addingQuestion); setQuestionEditId(""); }} className={`${secondaryButton} px-3`}>{addingQuestion ? "Batal" : "+ Tambah soal"}</button> : null}</div>
          {addingQuestion && !selected.is_published ? <form key={`new-question-${selected.id}`} action={createSelectionQuestionAction} className="grid gap-3 border-b border-slate-200 bg-teal-50/30 p-4 sm:grid-cols-2"><input type="hidden" name="testId" value={selected.id} /><h5 className="text-sm font-bold text-slate-900 sm:col-span-2">Tambah soal ke {selected.title}</h5><QuestionFields /><button className={`${primaryButton} justify-self-start sm:col-span-2`}>Simpan soal</button></form> : null}
          {packageQuestions.length ? <ol className="divide-y divide-slate-100">{packageQuestions.map((question, index) => <li key={question.id} className="px-4 py-4"><div className="flex items-start gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-700">{index + 1}</span><div className="min-w-0 flex-1"><p className="whitespace-pre-wrap text-sm font-medium leading-5 text-slate-900">{question.prompt.text}</p><p className="mt-1 text-xs text-slate-500">{types.find((type) => type.value === question.question_type)?.label ?? question.question_type} · {question.points} poin</p></div>{!selected.is_published ? <button type="button" onClick={() => { setQuestionEditId(questionEditId === question.id ? "" : question.id); setAddingQuestion(false); }} aria-expanded={questionEditId === question.id} className="min-h-10 shrink-0 rounded-md px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-teal-700">{questionEditId === question.id ? "Tutup" : "Edit"}</button> : null}</div>{questionEditId === question.id ? <form key={`question-${question.id}`} action={updateSelectionQuestionAction} className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2"><input type="hidden" name="testId" value={selected.id} /><QuestionFields question={question} /><button className={`${primaryButton} justify-self-start sm:col-span-2`}>Simpan perubahan soal</button></form> : null}</li>)}</ol> : !addingQuestion ? <div className="m-4 rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center"><p className="text-sm font-semibold text-slate-800">Paket ini belum punya soal</p><p className="mt-1 text-sm text-slate-600">Tambahkan soal pertama sebelum menerbitkan paket.</p>{!selected.is_published ? <button type="button" onClick={() => setAddingQuestion(true)} className={`${primaryButton} mt-4`}>+ Tambah soal pertama</button> : null}</div> : null}
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs text-slate-600">{selected.is_published ? "Paket terbit terkunci agar hasil peserta tetap konsisten." : "Draf hanya bisa ditugaskan setelah diterbitkan dan memiliki soal."}</p>{!selected.is_published && packageQuestions.length ? <form action={publishSelectionTestAction}><input type="hidden" name="testId" value={selected.id} /><button className={primaryButton}>Terbitkan paket</button></form> : null}</footer>
        </> : <div className="px-5 py-12 text-center"><h3 className="text-base font-bold text-slate-900">Pilih paket tes</h3><p className="mt-1 text-sm text-slate-600">Pilih paket dari daftar atau buat paket baru untuk memulai.</p></div>}
      </section>
    </div>
  </section>;
}
