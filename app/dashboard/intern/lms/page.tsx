import { getInternEnrollments } from "@/features/lms/queries";
import { getInternProfileId } from "@/features/daily-reports/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, Calendar, ArrowRight } from "lucide-react";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
}

export default async function InternLmsPage() {
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

  const { data: enrollments } = await getInternEnrollments(profile.id);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase text-teal-700">Peserta</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">LMS Pembelajaran</h1>
        <p className="mt-2 max-w-2xl leading-7 text-slate-600">
          Akses modul materi pelajaran, kuis evaluasi, dan tugas praktis yang disiapkan mentor.
        </p>
      </div>

      {enrollments.length === 0 ? (
        <div className="surface p-8 text-center text-slate-600">
          Belum ada modul kursus yang ditugaskan untuk Anda. Hubungi mentor atau admin untuk mendaftarkan Anda ke kelas pembelajaran.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {enrollments.map((e) => (
            <article key={e.course_id} className="surface p-6 bg-white hover:border-teal-500 transition-all flex flex-col justify-between">
              <div>
                <div className="bg-teal-50 text-teal-700 p-2.5 rounded-lg w-fit mb-4">
                  <BookOpen size={22} />
                </div>
                <h2 className="text-xl font-bold text-slate-950 leading-tight">
                  {e.course?.title}
                </h2>
                <p className="mt-2 text-sm text-slate-600 line-clamp-3 leading-relaxed">
                  {e.course?.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar size={13} />
                  <span>Terdaftar: {formatDate(e.enrolled_at)}</span>
                </div>
                <Link
                  href={`/dashboard/intern/lms/${e.course_id}`}
                  className="button-primary w-full text-center flex items-center justify-center gap-1"
                >
                  Buka Kelas <ArrowRight size={15} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
