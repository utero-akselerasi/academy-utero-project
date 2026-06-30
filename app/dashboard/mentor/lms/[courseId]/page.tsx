import { getMentorCourseDetails } from "@/features/lms/queries";
import { createLessonAction, createAssignmentAction } from "@/features/lms/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, FileText, Plus, Calendar, HelpCircle } from "lucide-react";

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
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Tombol Kembali */}
      <div className="mb-6">
        <Link
          href="/dashboard/mentor/lms"
          className="button-secondary text-sm flex items-center gap-1.5 w-fit"
        >
          <ArrowLeft size={16} /> Kembali ke LMS
        </Link>
      </div>

      {/* Header Detail Kelas */}
      <section className="surface p-6 bg-white border border-slate-200 rounded-xl mb-8">
        <p className="text-xs font-bold uppercase tracking-wider text-teal-700">Manajemen Kelas</p>
        <h1 className="text-3xl font-black text-slate-950 mt-1">{course.title}</h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-3xl">
          {course.description}
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* KOLOM KIRI: MANAJEMEN MATERI */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-xl font-bold text-slate-950 flex items-center gap-2">
              <BookOpen size={20} className="text-teal-700" />
              <span>Materi Pelajaran ({lessons.length})</span>
            </h2>
          </div>

          {/* Form Tambah Materi */}
          <form action={createLessonAction} className="surface p-5 bg-slate-50/50 border border-slate-200 rounded-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1">
              <Plus size={16} className="text-teal-700" />
              <span>Tambah Materi Baru</span>
            </h3>
            <input type="hidden" name="courseId" value={course.id} />

            <div className="form-field">
              <label className="form-label text-xs" htmlFor="lessonTitle">Judul Materi *</label>
              <input
                className="form-input text-sm"
                id="lessonTitle"
                name="title"
                placeholder="Contoh: Pengenalan UI/UX Dasar"
                required
              />
            </div>

            <div className="form-field">
              <label className="form-label text-xs" htmlFor="lessonVideo">Link Video Youtube (Opsional)</label>
              <input
                className="form-input text-sm"
                id="lessonVideo"
                name="videoUrl"
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>

            <div className="form-field">
              <label className="form-label text-xs" htmlFor="lessonContent">Teks Konten Materi *</label>
              <textarea
                className="form-input text-xs"
                id="lessonContent"
                name="content"
                rows={3}
                placeholder="Tulis materi bacaan kelas di sini..."
                required
              />
            </div>

            <button type="submit" className="button-primary text-xs py-2 w-full min-h-0">
              Simpan Materi
            </button>
          </form>

          {/* List Materi */}
          <div className="grid gap-2">
            {lessons.length === 0 ? (
              <p className="text-sm text-slate-500 italic p-3 text-center">Belum ada materi pelajaran.</p>
            ) : (
              lessons.map((lesson) => (
                <div key={lesson.id} className="surface p-3 bg-white flex items-center justify-between gap-3 text-sm">
                  <div>
                    <h4 className="font-bold text-slate-900 leading-snug">{lesson.title}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Order Index: {lesson.order_index}</p>
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
            <h2 className="text-xl font-bold text-slate-950 flex items-center gap-2 border-b border-slate-200 pb-3">
              <FileText size={20} className="text-teal-700" />
              <span>Tugas Kelas ({assignments.length})</span>
            </h2>

            {/* Form Tambah Tugas */}
            <form action={createAssignmentAction} className="surface p-5 bg-slate-50/50 border border-slate-200 rounded-xl space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1">
                <Plus size={16} className="text-teal-700" />
                <span>Tambah Tugas Baru</span>
              </h3>
              <input type="hidden" name="courseId" value={course.id} />

              <div className="form-field">
                <label className="form-label text-xs" htmlFor="assTitle">Judul Tugas *</label>
                <input
                  className="form-input text-sm"
                  id="assTitle"
                  name="title"
                  placeholder="Contoh: Praktek Wireframe Landing Page"
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label text-xs" htmlFor="assDesc">Instruksi Tugas</label>
                <textarea
                  className="form-input text-xs"
                  id="assDesc"
                  name="description"
                  rows={2}
                  placeholder="Jelaskan instruksi tugas praktis..."
                />
              </div>

              <div className="form-field">
                <label className="form-label text-xs" htmlFor="assDue">Batas Waktu Pengumpulan (Deadline)</label>
                <input
                  type="datetime-local"
                  className="form-input text-sm"
                  id="assDue"
                  name="dueAt"
                />
              </div>

              <button type="submit" className="button-primary text-xs py-2 w-full min-h-0">
                Simpan Tugas
              </button>
            </form>

            {/* List Tugas */}
            <div className="grid gap-2">
              {assignments.length === 0 ? (
                <p className="text-sm text-slate-500 italic p-3 text-center">Belum ada tugas kelas.</p>
              ) : (
                assignments.map((ass) => (
                  <div key={ass.id} className="surface p-3 bg-white flex flex-col gap-1 text-sm">
                    <h4 className="font-bold text-slate-900 leading-snug">{ass.title}</h4>
                    {ass.due_at && (
                      <p className="text-[10px] text-red-500 font-bold">
                        Deadline: {formatDate(ass.due_at)}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bagian Kuis */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-950 flex items-center gap-2 border-b border-slate-200 pb-3">
              <HelpCircle size={20} className="text-teal-700" />
              <span>Kuis Evaluasi ({quizzes.length})</span>
            </h2>

            <div className="grid gap-2">
              {quizzes.length === 0 ? (
                <p className="text-sm text-slate-500 italic p-3 text-center">Belum ada kuis.</p>
              ) : (
                quizzes.map((quiz) => (
                  <div key={quiz.id} className="surface p-3 bg-white flex items-center justify-between gap-3 text-sm">
                    <div>
                      <h4 className="font-bold text-slate-900 leading-snug">{quiz.title}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">KKM: {quiz.passing_score ?? 70}</p>
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
