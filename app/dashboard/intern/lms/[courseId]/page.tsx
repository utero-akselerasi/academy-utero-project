import { getCourseDetails } from "@/features/lms/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, CheckCircle2, Circle, AlertCircle, FileText, Check } from "lucide-react";

type Props = {
  params: Promise<{ courseId: string }>;
};

export default async function InternCourseDetailPage({ params }: Props) {
  const { courseId } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .schema("utero_academy")
    .from("intern_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="surface p-6 text-sm font-semibold text-red-700">
          Profil peserta belum ditemukan.
        </div>
      </main>
    );
  }

  const { data, error } = await getCourseDetails(courseId, profile.id);

  if (error || !data) {
    notFound();
  }

  const { course, lessons, quizzes, assignments } = data;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Tombol Kembali */}
      <div className="mb-6">
        <Link
          href="/dashboard/intern/lms"
          className="button-secondary text-sm flex items-center gap-1.5 w-fit"
        >
          <ArrowLeft size={16} /> Kembali ke LMS
        </Link>
      </div>

      {/* Detail Kelas */}
      <section className="surface p-6 bg-white border border-slate-200 rounded-xl mb-8">
        <p className="text-xs font-bold uppercase tracking-wider text-teal-700">Modul Kelas</p>
        <h1 className="text-3xl font-black text-slate-950 mt-1">{course.title}</h1>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed max-w-3xl">
          {course.description}
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        {/* Kolom Kiri: Pelajaran/Lessons */}
        <div>
          <h2 className="mb-4 text-lg font-bold text-slate-950 flex items-center gap-2">
            <BookOpen size={18} className="text-teal-700" />
            <span>Materi Pelajaran ({lessons.length})</span>
          </h2>

          <div className="grid gap-2">
            {lessons.length === 0 ? (
              <div className="surface p-6 text-center text-slate-500 text-sm">
                Materi pelajaran belum diunggah untuk kelas ini.
              </div>
            ) : (
              lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="surface p-4 bg-white hover:border-teal-500 transition-all flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    {lesson.is_completed ? (
                      <CheckCircle2 className="text-teal-600 shrink-0" size={20} />
                    ) : (
                      <Circle className="text-slate-300 shrink-0" size={20} />
                    )}
                    <div>
                      <h3 className="font-bold text-slate-900 leading-snug">
                        {lesson.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">Materi {lesson.order_index + 1}</p>
                    </div>
                  </div>

                  <Link
                    href={`/dashboard/intern/lms/${courseId}/lessons/${lesson.id}`}
                    className="button-secondary text-xs font-bold py-1 px-3 min-h-0"
                  >
                    Buka
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Kolom Kanan: Evaluasi (Quiz & Tugas) */}
        <div className="space-y-8">
          {/* Bagian Kuis */}
          <div>
            <h2 className="mb-4 text-lg font-bold text-slate-950 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-teal-700" />
              <span>Kuis Evaluasi ({quizzes.length})</span>
            </h2>

            <div className="grid gap-2">
              {quizzes.length === 0 ? (
                <div className="surface p-6 text-center text-slate-500 text-sm">
                  Kuis belum tersedia untuk kelas ini.
                </div>
              ) : (
                quizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="surface p-4 bg-white hover:border-teal-500 transition-all flex items-center justify-between gap-4"
                  >
                    <div>
                      <h3 className="font-bold text-slate-900 leading-snug">
                        {quiz.title}
                      </h3>
                      {quiz.best_score !== null ? (
                        <p className="text-xs text-teal-700 font-bold mt-1 bg-teal-50 border border-teal-100 rounded px-1.5 py-0.5 w-fit">
                          Skor Terbaik: {quiz.best_score} (KKM: {quiz.passing_score ?? 70})
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1">Belum dikerjakan</p>
                      )}
                    </div>

                    <Link
                      href={`/dashboard/intern/lms/${courseId}/quizzes/${quiz.id}`}
                      className="button-secondary text-xs font-bold py-1 px-3 min-h-0 shrink-0"
                    >
                      {quiz.best_score !== null ? "Ulangi" : "Mulai"}
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bagian Tugas */}
          <div>
            <h2 className="mb-4 text-lg font-bold text-slate-950 flex items-center gap-2">
              <FileText size={18} className="text-teal-700" />
              <span>Tugas Kelas ({assignments.length})</span>
            </h2>

            <div className="grid gap-2">
              {assignments.length === 0 ? (
                <div className="surface p-6 text-center text-slate-500 text-sm">
                  Tugas kelas belum ditambahkan.
                </div>
              ) : (
                assignments.map((ass) => {
                  const isSubmitted = !!ass.submission;
                  const isGraded = ass.submission && ass.submission.score !== null;

                  return (
                    <div
                      key={ass.id}
                      className="surface p-4 bg-white hover:border-teal-500 transition-all flex items-center justify-between gap-4"
                    >
                      <div>
                        <h3 className="font-bold text-slate-900 leading-snug">
                          {ass.title}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {isGraded ? (
                            <span className="text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded px-2 py-0.5">
                              Nilai: {ass.submission?.score}
                            </span>
                          ) : isSubmitted ? (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                              Menunggu Penilaian
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-red-800 bg-red-50 border border-red-200 rounded px-2 py-0.5">
                              Belum Dikumpulkan
                            </span>
                          )}
                        </div>
                      </div>

                      <Link
                        href={`/dashboard/intern/lms/${courseId}/assignments/${ass.id}`}
                        className="button-secondary text-xs font-bold py-1 px-3 min-h-0 shrink-0"
                      >
                        {isSubmitted ? "Lihat" : "Kumpulkan"}
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
