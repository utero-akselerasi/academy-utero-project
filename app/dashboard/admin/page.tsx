export const dynamic = "force-dynamic";

import Link from "next/link";
import { getAdminDashboardStats } from "@/features/admin/dashboard-queries";
import { StatsVisualization } from "@/features/dashboard/StatsVisualization";
import { Users, GraduationCap, CheckSquare, BarChart2, ChevronRight, FileText, Settings, ShieldAlert, Clock } from "lucide-react";

function StatCard({ title, value, description, icon, color = "bg-teal-50 text-teal-700" }: { title: string; value: string | number; description: string; icon: React.ReactNode, color?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-900">{value}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <div className={"rounded-xl p-3 " + color}>{icon}</div>
      </div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const { metrics, activities } = await getAdminDashboardStats();

  const taskChartData = [
    { label: "Selesai", value: metrics.completedTasks },
    { label: "Pending", value: Math.max(0, metrics.totalTasks - metrics.completedTasks) },
  ];

  const attendanceTrendData = [
    { label: "Senin", value: 85 },
    { label: "Selasa", value: 88 },
    { label: "Rabu", value: 92 },
    { label: "Kamis", value: 94 },
    { label: "Jumat", value: 96 },
    { label: "Sabtu", value: metrics.attendanceRate },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:py-10 space-y-8">
      {/* Header Panel */}
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-teal-700 to-emerald-700 p-8 text-white shadow-lg">
        <p className="text-sm/6 text-teal-100 font-bold uppercase tracking-wider">Dashboard Utama</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">Utero Academy Admin</h1>
        <p className="mt-3 max-w-3xl text-sm text-teal-50 md:text-base">
          Kelola modul pembelajaran LMS, validasi pendaftaran magang, review monitoring absensi, dan pengaturan CMS situs.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link href="/dashboard/admin/pendaftaran" className="rounded-full bg-slate-950 px-4 py-2 font-bold text-white hover:bg-slate-800 shadow-sm transition-all">Review Pendaftaran</Link>
          <Link href="/dashboard/admin/cms" className="rounded-full border border-white/40 bg-white/10 px-4 py-2 font-bold text-white hover:bg-white/20 transition-all">Manajemen CMS</Link>
        </div>
      </section>

      {/* Metrics Cards */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Peserta Aktif" value={metrics.totalInterns} description="Siswa magang aktif" icon={<Users size={22} />} color="bg-teal-50 text-teal-700" />
        <StatCard title="Instansi Partner" value={metrics.totalSchools} description="Sekolah/kampus terdaftar" icon={<GraduationCap size={22} />} color="bg-blue-50 text-blue-700" />
        <StatCard title="Total Tugas" value={metrics.totalTasks} description={metrics.completedTasks + " tugas selesai"} icon={<CheckSquare size={22} />} color="bg-amber-50 text-amber-700" />
        <StatCard title="Rata Kehadiran" value={metrics.attendanceRate + "%"} description="Rate kehadiran global" icon={<BarChart2 size={22} />} color="bg-indigo-50 text-indigo-700" />
      </section>

      {/* Interactive Charts */}
      <section className="grid gap-6 md:grid-cols-2">
        <StatsVisualization 
          title="Keaktifan Absensi Mingguan" 
          subtitle="Tingkat kehadiran harian (Senin - Sabtu)" 
          data={attendanceTrendData} 
          type="line" 
          color="#CE181E" 
        />
        <StatsVisualization 
          title="Progress Pengerjaan Tugas" 
          subtitle="Perbandingan tugas selesai vs tugas pending" 
          data={taskChartData} 
          type="bar" 
          color="#3b82f6" 
        />
      </section>

      {/* Bottom Grid: Activities & Shortcuts */}
      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Aktivitas Terbaru */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Aktivitas Absensi Terbaru</h2>
            <p className="text-sm text-slate-500">Log kehadiran terakhir anak magang.</p>
            
            <div className="mt-5 divide-y divide-slate-100">
              {activities.map((act) => (
                <div key={act.id} className="flex items-start justify-between gap-4 py-3.5">
                  <div className="flex gap-3">
                    <span className="p-2 rounded-lg bg-teal-50 text-teal-700 h-fit mt-0.5"><Clock size={16} /></span>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{act.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{act.description}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold">{act.date}</span>
                </div>
              ))}
              {activities.length === 0 && (
                <p className="py-6 text-sm text-slate-500 text-center italic">Belum ada aktivitas absensi terbaru.</p>
              )}
            </div>
          </div>
        </div>

        {/* Shortcut Quick Links */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Menu Pengelola</h2>
          <div className="flex flex-col gap-2">
            <Link href="/dashboard/admin/pendaftaran" className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-slate-50 transition-all font-semibold text-xs text-slate-700 group">
              <span className="flex items-center gap-2">
                <FileText size={16} className="text-slate-400 group-hover:text-teal-700" />
                <span>Pendaftaran Magang</span>
              </span>
              <ChevronRight size={14} className="text-slate-400 group-hover:text-teal-700" />
            </Link>
            
            <Link href="/dashboard/admin/cms" className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-slate-50 transition-all font-semibold text-xs text-slate-700 group">
              <span className="flex items-center gap-2">
                <Settings size={16} className="text-slate-400 group-hover:text-teal-700" />
                <span>Website CMS</span>
              </span>
              <ChevronRight size={14} className="text-slate-400 group-hover:text-teal-700" />
            </Link>

            <Link href="/dashboard/super-admin/users" className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-slate-50 transition-all font-semibold text-xs text-slate-700 group">
              <span className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-slate-400 group-hover:text-teal-700" />
                <span>Super Admin (User & Role)</span>
              </span>
              <ChevronRight size={14} className="text-slate-400 group-hover:text-teal-700" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}


