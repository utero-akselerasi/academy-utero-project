import { getInternEnrollments, getAllCourses } from "@/features/lms/queries";
import { getInternProfileId } from "@/features/daily-reports/queries";
import { enrollCourseAction } from "@/features/lms/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, Calendar, ArrowRight, Plus } from "lucide-react";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
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
  const { data: allCourses } = await getAllCourses();

  // Filter courses yang belum di-enroll
  const enrolledIds = new Set(enrollments.map(e => e.course_id));
  const availableCourses = (allCourses || []).filter(c => !enrolledIds.has(c.id) && c.status === "published");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-10">
      <div>
        <p className="text-sm font-bold uppercase text-teal-700">Peserta</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">LMS Pembelajaran</h1>
        <p className="mt-2 max-w-2xl leading-7 text-slate-600">
          Akses modul materi pelajaran, kuis evaluasi, dan tugas praktis yang disiapkan mentor.
        </p>
      </div>

      {/* Bagian 1: Kelas Saya */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-teal-600" />
          <span>Kelas Saya ({enrollments.length})</span>
        </h2>

        {enrollments.length === 0 ? (
          <div className="surface p-8 text-center text-slate-500 text-sm">
            Anda belum mengikuti kelas apa pun. Silakan pilih kelas di bawah untuk memulai.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {enrollments.map((e) => (
              <article key={e.course_id} className="surface p-6 bg-white hover:border-teal-500 transition-all flex flex-col justify-between">
                <div>
                  <div className="bg-teal-50 text-teal-700 p-2.5 rounded-lg w-fit mb-4">
                    <BookOpen size={22} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-950 leading-tight">
                    {e.course?.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 line-clamp-3 leading-relaxed">
                    {e.course?.description || "Tidak ada deskripsi."}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Calendar size={13} />
                    <span>Terdaftar: {formatDate(e.enrolled_at)}</span>
                  </div>
                  <Link
                    href={'/dashboard/intern/lms/' + e.course_id}
                    className="button-primary w-full text-center flex items-center justify-center gap-1"
                  >
                    Buka Kelas <ArrowRight size={15} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Bagian 2: Kelas yang Tersedia */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          <span>Kelas Tersedia ({availableCourses.length})</span>
        </h2>

        {availableCourses.length === 0 ? (
          <div className="surface p-8 text-center text-slate-500 text-sm">
            Semua kelas sudah diikuti atau belum ada kelas baru yang tersedia.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {availableCourses.map((c) => (
              <article key={c.id} className="surface p-6 bg-slate-50 hover:border-teal-500/50 transition-all flex flex-col justify-between border border-slate-200">
                <div>
                  <div className="bg-slate-200/80 text-slate-600 p-2.5 rounded-lg w-fit mb-4">
                    <BookOpen size={22} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-950 leading-tight">
                    {c.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 line-clamp-3 leading-relaxed">
                    {c.description || "Tidak ada deskripsi."}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200">
                  <form action={enrollCourseAction}>
                    <input type="hidden" name="courseId" value={c.id} />
                    <button
                      type="submit"
                      className="button-secondary w-full text-center flex items-center justify-center gap-1.5 font-bold hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300"
                    >
                      <Plus size={15} />
                      <span>Ikuti Kelas</span>
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
