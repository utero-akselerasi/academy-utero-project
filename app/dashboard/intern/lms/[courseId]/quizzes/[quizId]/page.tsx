import { getQuiz } from "@/features/lms/queries";
import { submitQuizAttemptAction } from "@/features/lms/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, HelpCircle, Award, CheckCircle2, AlertCircle } from "lucide-react";

type Props = {
  params: Promise<{ courseId: string; quizId: string }>;
};

export default async function InternQuizPage({ params }: Props) {
  const { courseId, quizId } = await params;

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

  const { data: quiz, error } = await getQuiz(quizId, profile.id);

  if (error || !quiz) {
    notFound();
  }

  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const latestAttempt = quiz.attempts.length > 0 ? quiz.attempts[0] : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* Tombol Kembali */}
      <div className="mb-6">
        <Link
          href={`/dashboard/intern/lms/${courseId}`}
          className="button-secondary text-sm flex items-center gap-1.5 w-fit"
        >
          <ArrowLeft size={16} /> Kembali ke Kelas
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
        {/* Kiri: Form Kuis */}
        <div className="surface p-6 bg-white border border-slate-200 rounded-xl space-y-6">
          <div>
            <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100 uppercase">
              Evaluasi Pembelajaran
            </span>
            <h1 className="text-2xl font-black text-slate-950 mt-1 leading-snug">{quiz.title}</h1>
            <p className="text-xs text-slate-400 mt-1 font-semibold">KKM kelulusan kuis ini: {quiz.passing_score ?? 70}</p>
          </div>

          <form action={submitQuizAttemptAction} className="space-y-6 border-t border-slate-100 pt-6">
            <input type="hidden" name="quizId" value={quiz.id} />
            <input type="hidden" name="courseId" value={courseId} />

            {questions.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Pertanyaan kuis kosong.</p>
            ) : (
              questions.map((q: any, index: number) => (
                <div key={q.id || index} className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900 flex items-start gap-2 leading-relaxed">
                    <span className="bg-teal-600 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <span>{q.question}</span>
                  </h4>
                  
                  <div className="grid gap-2 pl-7">
                    {Array.isArray(q.options) && q.options.map((opt: string, optIdx: number) => {
                      const radioId = `q_${q.id}_${optIdx}`;
                      return (
                        <label key={optIdx} htmlFor={radioId} className="flex items-center gap-2 text-xs text-slate-700 font-semibold cursor-pointer bg-white p-2 rounded-lg border border-slate-200 hover:border-teal-500 hover:bg-teal-50/20 transition-all">
                          <input
                            id={radioId}
                            type="radio"
                            name={`q_${q.id}`}
                            value={opt}
                            required
                            className="text-teal-600 focus:ring-teal-500 h-4 w-4"
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))
            )}

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                className="button-primary font-bold px-6 py-2"
                disabled={questions.length === 0}
              >
                Kirim Jawaban Kuis
              </button>
            </div>
          </form>
        </div>

        {/* Kanan: Riwayat Percobaan */}
        <div className="space-y-6">
          <div className="surface p-5 bg-white border border-slate-200 rounded-xl space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Award size={18} className="text-teal-700" />
              <span>Hasil Percobaan</span>
            </h3>

            {quiz.attempts.length === 0 ? (
              <div className="text-center p-4 bg-slate-50 rounded-lg text-xs text-slate-500 font-medium">
                Belum ada percobaan kuis. Kirim kuis untuk melihat hasil.
              </div>
            ) : (
              <div className="space-y-3">
                {latestAttempt && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center space-y-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Hasil Terakhir</span>
                    <span className={`text-4xl font-black block ${
                      latestAttempt.score >= (quiz.passing_score ?? 70) ? "text-teal-600" : "text-red-600"
                    }`}>
                      {latestAttempt.score}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border inline-block ${
                      latestAttempt.score >= (quiz.passing_score ?? 70) 
                        ? "bg-teal-50 border-teal-200 text-teal-800" 
                        : "bg-red-50 border-red-200 text-red-800"
                    }`}>
                      {latestAttempt.score >= (quiz.passing_score ?? 70) ? "LULUS" : "REMIDI"}
                    </span>
                  </div>
                )}

                <div className="text-xs font-bold text-slate-500 px-1">Riwayat ({quiz.attempts.length}):</div>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {quiz.attempts.map((att, idx) => (
                    <div key={att.id || idx} className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-bold text-slate-700 block">Skor: {att.score}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">{new Date(att.submitted_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) + " " + new Date(att.submitted_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <span className={`font-black uppercase text-[10px] ${
                        att.score >= (quiz.passing_score ?? 70) ? "text-teal-600" : "text-red-500"
                      }`}>
                        {att.score >= (quiz.passing_score ?? 70) ? "Lulus" : "Remidi"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
