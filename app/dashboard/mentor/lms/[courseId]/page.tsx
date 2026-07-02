import { getMentorCourseDetails } from "@/features/lms/queries";
import { createLessonAction, createAssignmentAction, toggleLessonPublishAction, toggleQuizPublishAction, toggleAssignmentPublishAction } from "@/features/lms/actions";
import { QuizFormBuilder } from "@/features/lms/QuizFormBuilder";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, FileText, Plus, Calendar, HelpCircle, ChevronDown } from "lucide-react";

type Props = {
  params: Promise<{ courseId: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

export default async function MentorCourseDetailPage({ params }: Props) {
  const { courseId } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await getMentorCourseDetails(courseId);

  if (error || !data) {
    notFound();
  }

  const { course, lessons, quizzes, assignments } = data;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* Tombol Kembali */}
      <div className="mb-4">
        <Link
          href="/dashboard/mentor/lms"
          className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 text-sm font-semibold transition-all"
        >
          <ArrowLeft size={16} />
          <span>Kembali ke LMS</span>
        </Link>
      </div>

      {/* Header Detail Kelas */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-teal-700">Manajemen Kelas</p>
        <h1 className="text-2xl font-black text-slate-950 mt-1">{course.title}</h1>
        <p className="mt-2 text-sm text-slate-550 leading-relaxed max-w-3xl">
          {course.description || "Tidak ada deskripsi untuk kelas ini."}
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* KOLOM KIRI: MANAJEMEN MATERI */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
              <BookOpen size={20} className="text-teal-700" />
              <span>Materi Pelajaran ({lessons.length})</span>
            </h2>
          </div>

          {/* Form Tambah Materi Collapsible Accordion */}
          <details className="group bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex justify-between items-center p-4 font-bold text-xs text-slate-700 uppercase tracking-wider cursor-pointer select-none hover:bg-slate-100/60 transition-all">
              <span className="flex items-center gap-2">
                <Plus size={16} className="text-teal-700 shrink-0" />
                <span>Tambah Materi Baru</span>
              </span>
              <ChevronDown size={14} className="text-slate-400 group-open:rotate-180 transition-transform duration-200" />
            </summary>
            
            <form action={createLessonAction} className="p-5 border-t border-slate-200 bg-white space-y-4">
              <input type="hidden" name="courseId" value={course.id} />

              <div className="form-field">
                <label className="form-label text-xs font-bold text-slate-700" htmlFor="lessonTitle">Judul Materi *</label>
                <input
                  className="form-input text-sm"
                  id="lessonTitle"
                  name="title"
                  placeholder="Contoh: Pengenalan UI/UX Dasar"
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label text-xs font-bold text-slate-700" htmlFor="lessonVideo">Link Video Youtube (Opsional)</label>
                <input
                  className="form-input text-sm"
                  id="lessonVideo"
                  name="videoUrl"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>

              <div className="form-field">
                <label className="form-label text-xs font-bold text-slate-700" htmlFor="lessonContent">Teks Konten Materi *</label>
                <textarea
                  className="form-input text-xs min-h-[100px]"
                  id="lessonContent"
                  name="content"
                  rows={4}
                  placeholder="Tulis materi bacaan kelas di sini..."
                  required
                />
              </div>

              <div className="pt-2">
                <button type="submit" className="button-primary text-xs py-2 w-full min-h-0 font-bold">
                  Simpan Materi
                </button>
              </div>
            </form>
          </details>

          {/* List Materi */}
          <div className="grid gap-3">
            {lessons.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-6 text-center bg-slate-50 rounded-xl border border-slate-200/50">Belum ada materi pelajaran.</p>
            ) : (
              lessons.map((lesson) => (
                <div key={lesson.id} className="surface p-4 bg-white border border-slate-200 rounded-xl hover:border-teal-500/30 transition-all flex items-center justify-between gap-3 text-xs">
                  <div>
                    <h4 className="font-bold text-slate-850 leading-snug">{lesson.title}</h4>
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold">Tipe: Video / Bacaan | Index: {lesson.order_index}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <form action={toggleLessonPublishAction} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg shadow-sm hover:border-teal-500 transition-colors">
                      <input type="hidden" name="lessonId" value={lesson.id} />
                      <input type="hidden" name="courseId" value={course.id} />
                      <input type="hidden" name="isPublished" value={lesson.is_published === false ? "true" : "false"} />
                      <span className={"w-2 h-2 rounded-full " + (lesson.is_published !== false ? "bg-teal-500" : "bg-slate-300")} />
                      <button type="submit" className={"text-[10px] font-bold " + (lesson.is_published !== false ? "text-teal-800" : "text-slate-600 hover:text-slate-900")}>
                        {lesson.is_published !== false ? "Published" : "Draft"}
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* KOLOM KANAN: MANAJEMEN TUGAS & KUIS */}
        <div className="space-y-8">
          {/* Bagian Tugas */}
          <div className="space-y-6">
            <h2 className="text-lg font-black text-slate-950 flex items-center gap-2 border-b border-slate-200 pb-3">
              <FileText size={20} className="text-teal-700" />
              <span>Tugas Kelas ({assignments.length})</span>
            </h2>

            {/* Form Tambah Tugas Collapsible Accordion */}
            <details className="group bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm [&_summary::-webkit-details-marker]:hidden mb-4">
              <summary className="flex justify-between items-center p-4 font-bold text-xs text-slate-700 uppercase tracking-wider cursor-pointer select-none hover:bg-slate-100/60 transition-all">
                <span className="flex items-center gap-2">
                  <Plus size={16} className="text-teal-700 shrink-0" />
                  <span>Tambah Tugas Baru</span>
                </span>
                <ChevronDown size={14} className="text-slate-400 group-open:rotate-180 transition-transform duration-200" />
              </summary>

              <form action={createAssignmentAction} className="p-5 border-t border-slate-200 bg-white space-y-4">
                <input type="hidden" name="courseId" value={course.id} />

                <div className="form-field">
                  <label className="form-label text-xs font-bold text-slate-700" htmlFor="assTitle">Judul Tugas *</label>
                  <input
                    className="form-input text-sm"
                    id="assTitle"
                    name="title"
                    placeholder="Contoh: Praktek Wireframe Landing Page"
                    required
                  />
                </div>

                <div className="form-field">
                  <label className="form-label text-xs font-bold text-slate-700" htmlFor="assDesc">Instruksi Tugas</label>
                  <textarea
                    className="form-input text-xs min-h-[80px]"
                    id="assDesc"
                    name="description"
                    rows={3}
                    placeholder="Jelaskan instruksi tugas praktis..."
                  />
                </div>

                <div className="form-field">
                  <label className="form-label text-xs font-bold text-slate-700" htmlFor="assDue">Batas Waktu Pengumpulan (Deadline)</label>
                  <input
                    type="datetime-local"
                    className="form-input text-sm"
                    id="assDue"
                    name="dueAt"
                  />
                </div>

                <div className="pt-2">
                  <button type="submit" className="button-primary text-xs py-2 w-full min-h-0 font-bold">
                    Simpan Tugas
                  </button>
                </div>
              </form>
            </details>

            {/* List Tugas */}
            <div className="grid gap-3">
              {assignments.length === 0 ? (
                <p className="text-xs text-slate-400 italic p-6 text-center bg-slate-50 rounded-xl border border-slate-200/50">Belum ada tugas kelas.</p>
              ) : (
                assignments.map((ass) => (
                  <div key={ass.id} className="surface p-4 bg-white border border-slate-200 rounded-xl hover:border-teal-500/30 transition-all flex items-center justify-between gap-3 text-xs">
                    <div>
                      <h4 className="font-bold text-slate-850 leading-snug">{ass.title}</h4>
                      {ass.due_at && (
                        <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                          <Calendar size={11} />
                          <span>Batas Waktu: {formatDate(ass.due_at)}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <form action={toggleAssignmentPublishAction} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg shadow-sm hover:border-teal-500 transition-colors">
                        <input type="hidden" name="assignmentId" value={ass.id} />
                        <input type="hidden" name="courseId" value={course.id} />
                        <input type="hidden" name="isPublished" value={ass.is_published === false ? "true" : "false"} />
                        <span className={"w-2 h-2 rounded-full " + (ass.is_published !== false ? "bg-teal-500" : "bg-slate-300")} />
                        <button type="submit" className={"text-[10px] font-bold " + (ass.is_published !== false ? "text-teal-800" : "text-slate-600 hover:text-slate-900")}>
                          {ass.is_published !== false ? "Published" : "Draft"}
                        </button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bagian Kuis */}
          <div className="space-y-6">
            <h2 className="text-lg font-black text-slate-950 flex items-center gap-2 border-b border-slate-200 pb-3">
              <HelpCircle size={20} className="text-teal-700" />
              <span>Kuis Evaluasi ({quizzes.length})</span>
            </h2>

            {/* Form Tambah Kuis Collapsible Accordion dengan Visual Question Builder */}
            <details className="group bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm [&_summary::-webkit-details-marker]:hidden mb-4">
              <summary className="flex justify-between items-center p-4 font-bold text-xs text-slate-700 uppercase tracking-wider cursor-pointer select-none hover:bg-slate-100/60 transition-all">
                <span className="flex items-center gap-2">
                  <Plus size={16} className="text-teal-700 shrink-0" />
                  <span>Tambah Kuis Baru</span>
                </span>
                <ChevronDown size={14} className="text-slate-400 group-open:rotate-180 transition-transform duration-200" />
              </summary>

              <div className="p-5 border-t border-slate-200 bg-white">
                <QuizFormBuilder courseId={course.id} />
              </div>
            </details>

            {/* List Kuis */}
            <div className="grid gap-3">
              {quizzes.length === 0 ? (
                <p className="text-xs text-slate-400 italic p-6 text-center bg-slate-50 rounded-xl border border-slate-200/50">Belum ada kuis.</p>
              ) : (
                quizzes.map((quiz) => (
                  <div key={quiz.id} className="surface p-4 bg-white border border-slate-200 rounded-xl hover:border-teal-500/30 transition-all flex items-center justify-between gap-3 text-xs">
                    <div>
                      <h4 className="font-bold text-slate-850 leading-snug">{quiz.title}</h4>
                      <p className="text-[10px] text-slate-400 mt-1 font-semibold">KKM Kelulusan: {quiz.passing_score ?? 70}%</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <form action={toggleQuizPublishAction} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg shadow-sm hover:border-teal-500 transition-colors">
                        <input type="hidden" name="quizId" value={quiz.id} />
                        <input type="hidden" name="courseId" value={course.id} />
                        <input type="hidden" name="isPublished" value={quiz.is_published === false ? "true" : "false"} />
                        <span className={"w-2 h-2 rounded-full " + (quiz.is_published !== false ? "bg-teal-500" : "bg-slate-300")} />
                        <button type="submit" className={"text-[10px] font-bold " + (quiz.is_published !== false ? "text-teal-800" : "text-slate-600 hover:text-slate-900")}>
                          {quiz.is_published !== false ? "Published" : "Draft"}
                        </button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
