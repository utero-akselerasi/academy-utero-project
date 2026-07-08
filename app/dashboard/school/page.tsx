import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSchoolDashboardStats, getSchoolInterns, getSchoolProfile } from "@/features/school/queries";
import { BarChart2, BookOpen, GraduationCap, Users, AlertTriangle, ArrowRight } from "lucide-react";

function StatCard({ title, value, description, icon }: { title: string; value: string | number; description: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-900">{value}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <div className="rounded-xl bg-blue-50 p-3 text-blue-700">{icon}</div>
      </div>
    </div>
  );
}

export default async function SchoolDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: schoolProfile, error } = await getSchoolProfile(user.id);
  if (error || !schoolProfile) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-900">
          Akses portal sekolah belum aktif. Hubungi Super Admin untuk menghubungkan akun Anda ke instansi.
        </div>
      </main>
    );
  }

  const [{ data: stats }, { data: interns }] = await Promise.all([
    getSchoolDashboardStats(schoolProfile.id),
    getSchoolInterns(schoolProfile.id),
  ]);

  const recentInterns = interns.slice(0, 5);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:py-10">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-blue-700 to-indigo-700 p-8 text-white shadow-lg">
        <p className="text-sm/6 text-blue-100">School Portal</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">{schoolProfile.name}</h1>
        <p className="mt-3 max-w-3xl text-sm text-blue-50 md:text-base">
          Pantau siswa magang, progres pembelajaran, kehadiran, dan hasil penilaian dalam satu dashboard terpusat.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link href="/dashboard/school/students" className="rounded-full bg-white px-4 py-2 font-semibold text-blue-700 hover:bg-blue-50">Lihat Siswa</Link>
          <Link href="/dashboard/school/reports" className="rounded-full border border-white/30 px-4 py-2 font-semibold text-white hover:bg-white/10">Laporan</Link>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Siswa" value={stats.totalInterns} description="Seluruh siswa terhubung" icon={<Users size={22} />} />
        <StatCard title="Siswa Aktif" value={stats.activeInterns} description="Sedang menjalani magang" icon={<GraduationCap size={22} />} />
        <StatCard title="Alumni" value={stats.alumniInterns} description="Sudah menyelesaikan program" icon={<BookOpen size={22} />} />
        <StatCard title="Attendance Rate" value={`${stats.avgAttendanceRate}%`} description="Rata-rata kehadiran siswa" icon={<BarChart2 size={22} />} />
        <StatCard title="Perlu Perhatian" value={stats.needAttentionCount} description="Attendance di bawah 80%" icon={<AlertTriangle size={22} />} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Siswa Terbaru</h2>
              <p className="text-sm text-slate-500">Daftar siswa yang terhubung ke sekolah Anda.</p>
            </div>
            <Link href="/dashboard/school/students" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800">
              Semua siswa <ArrowRight size={16} />
            </Link>
          </div>

          <div className="mt-5 divide-y divide-slate-100">
            {recentInterns.map((intern) => (
              <div key={intern.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-semibold text-slate-900">{intern.full_name}</p>
                  <p className="text-sm text-slate-500">{intern.major || "Jurusan belum diisi"} · {intern.status}</p>
                </div>
                <Link href={`/dashboard/school/students/${intern.id}`} className="text-sm font-semibold text-blue-700 hover:text-blue-800">Detail</Link>
              </div>
            ))}
            {recentInterns.length === 0 && <p className="py-6 text-sm text-slate-500">Belum ada siswa terhubung.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Ringkasan Cepat</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li>• Monitoring kehadiran per siswa.</li>
            <li>• Review daily report dan status revisi.</li>
            <li>• Pantau nilai akhir dan sertifikat.</li>
            <li>• Unduh laporan periodik untuk arsip sekolah.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
