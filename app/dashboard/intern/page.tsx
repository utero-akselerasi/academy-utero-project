import { createSupabaseServerClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { getInternProfileId, getInternDailyReports } from "@/features/daily-reports/queries";
import { getInternAttendances, getTodayAttendance } from "@/features/attendance/queries";
import { getInternCards } from "@/features/tasks/queries";
import { AttendanceStatusBadge } from "@/features/attendance/AttendanceStatusBadge";
import { ReportStatusBadge } from "@/features/daily-reports/ReportStatusBadge";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  ClipboardList, Clock, FileText, BookOpen, 
  CheckSquare, Calendar, ChevronRight, BarChart2,
  Award, AlertCircle
} from "lucide-react";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

function formatTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { timeStyle: "short" }).format(new Date(value));
}

export default async function InternDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = await createUteroAcademyServiceRoleClient();
  const internProfileId = await getInternProfileId(user.id);

  if (!internProfileId) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="surface p-6 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl">
          Profil magang Anda belum aktif. Hubungi pembimbing/admin untuk mengaktifkan status akun Anda.
        </div>
      </main>
    );
  }

  // Fetch all stats
  const [internProfileResult, tasksResult, attendancesResult, reportsResult, todayAttendance] = await Promise.all([
    db.from("intern_profiles").select("*, schools(name)").eq("id", internProfileId).maybeSingle(),
    getInternCards(internProfileId),
    getInternAttendances(internProfileId),
    getInternDailyReports(internProfileId),
    getTodayAttendance(internProfileId)
  ]);

  const internProfile = internProfileResult.data;
  const schoolObj = Array.isArray(internProfile?.schools) ? internProfile?.schools[0] : internProfile?.schools;
  const schoolName = schoolObj?.name || "-";

  const tasks = tasksResult.data || [];
  const attendances = attendancesResult.data || [];
  const reports = reportsResult.data || [];

  // Tasks math
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => {
    const checks = t.task_checklists || [];
    const doneChecks = checks.filter(c => c.is_done).length;
    const subs = t.task_subtasks || [];
    const doneSubs = subs.filter(s => s.is_done).length;
    
    if (checks.length > 0 || subs.length > 0) {
      return (checks.length === 0 || doneChecks === checks.length) && (subs.length === 0 || doneSubs === subs.length);
    }
    return true;
  }).length;

  // Attendance math
  const totalLogs = attendances.length;
  const presentDays = attendances.filter(a => a.attendance_type === "present").length;
  const permitDays = attendances.filter(a => a.attendance_type === "permit").length;
  const sickDays = attendances.filter(a => a.attendance_type === "sick").length;
  const attendanceRate = totalLogs > 0 ? Math.round((presentDays / totalLogs) * 100) : 100;

  // Today status
  let todayStatusLabel = "Belum Absen";
  let todayStatusColor = "bg-slate-100 text-slate-700 border-slate-200";

  if (todayAttendance) {
    if (todayAttendance.attendance_type === "permit") {
      todayStatusLabel = "Izin Mandiri";
      todayStatusColor = "bg-amber-50 text-amber-800 border-amber-200";
    } else if (todayAttendance.attendance_type === "sick") {
      todayStatusLabel = "Sakit";
      todayStatusColor = "bg-red-50 text-red-800 border-red-200";
    } else if (todayAttendance.check_out_at) {
      todayStatusLabel = "Selesai (Sudah Check-out)";
      todayStatusColor = "bg-teal-50 text-teal-800 border-teal-200";
    } else if (todayAttendance.check_in_at) {
      todayStatusLabel = "Aktif (Sudah Check-in)";
      todayStatusColor = "bg-sky-50 text-sky-850 border-sky-200";
    }
  }

  const modules = [
    {
      title: "Task Saya",
      description: "Lihat task yang ditugaskan mentor dan update progress checklist.",
      href: "/dashboard/intern/tasks",
      icon: ClipboardList,
      color: "text-teal-700 bg-teal-50 border-teal-150",
      badge: totalTasks - completedTasks > 0 ? `${totalTasks - completedTasks} aktif` : null
    },
    {
      title: "Absensi",
      description: "Check-in dan check-out harian dengan GPS dan selfie.",
      href: "/dashboard/intern/attendance",
      icon: Clock,
      color: "text-indigo-700 bg-indigo-50 border-indigo-150",
      badge: todayAttendance?.check_in_at && !todayAttendance?.check_out_at ? "Belum Check-out" : null
    },
    {
      title: "Daily Report",
      description: "Isi laporan harian: pekerjaan, progress, kendala, dan rencana besok.",
      href: "/dashboard/intern/daily-reports",
      icon: FileText,
      color: "text-amber-700 bg-amber-50 border-amber-150",
      badge: reports.some(r => r.status === "revision_requested") ? "Ada Revisi" : null
    },
    {
      title: "Materi Belajar",
      description: "Akses course, materi, quiz, dan assignment dari LMS.",
      href: "/dashboard/intern/lms",
      icon: BookOpen,
      color: "text-purple-700 bg-purple-50 border-purple-150",
      badge: "LMS"
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      {/* Welcome Section */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-teal-700">Dashboard Peserta</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">Selamat Datang, {internProfile?.full_name}!</h1>
          <p className="text-sm text-slate-500 mt-1">
            Instansi: <span className="font-semibold text-slate-700">{schoolName}</span> | Jurusan: <span className="font-semibold text-slate-700">{internProfile?.major || "-"}</span>
          </p>
        </div>

        {/* Absen Hari Ini Widget */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-250 p-3.5 rounded-xl self-stretch md:self-auto">
          <div className="rounded-lg bg-teal-100 p-2.5 text-teal-800 shrink-0">
            <Calendar size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Absensi Hari Ini</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`px-2 py-0.5 rounded text-xs font-extrabold uppercase border ${todayStatusColor}`}>
                {todayStatusLabel}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* KPI Stats widgets */}
      <section className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
          <span className="rounded-lg bg-teal-50 p-2 text-teal-700 inline-block">
            <CheckSquare size={18} />
          </span>
          <p className="text-xs text-slate-400 font-bold uppercase">Progres Tugas</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{completedTasks}</span>
            <span className="text-xs text-slate-400 font-bold">/ {totalTasks} Selesai</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
          <span className="rounded-lg bg-indigo-50 p-2 text-indigo-700 inline-block">
            <Clock size={18} />
          </span>
          <p className="text-xs text-slate-400 font-bold uppercase">Persentase Kehadiran</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{attendanceRate}%</span>
            <span className="text-xs text-slate-400 font-bold">{presentDays} Hari Masuk</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
          <span className="rounded-lg bg-amber-50 p-2 text-amber-700 inline-block">
            <FileText size={18} />
          </span>
          <p className="text-xs text-slate-400 font-bold uppercase">Laporan Harian</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{reports.length}</span>
            <span className="text-xs text-slate-400 font-bold">Laporan Dikirim</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
          <span className="rounded-lg bg-red-50 p-2 text-red-700 inline-block">
            <AlertCircle size={18} />
          </span>
          <p className="text-xs text-slate-400 font-bold uppercase">Izin & Sakit</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{permitDays + sickDays}</span>
            <span className="text-xs text-slate-400 font-bold">{permitDays} Izin, {sickDays} Sakit</span>
          </div>
        </div>
      </section>

      {/* Grid Menu Portal */}
      <section className="grid gap-6 md:grid-cols-2">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link 
              key={mod.title}
              href={mod.href}
              className="bg-white border border-slate-200 hover:border-teal-500 rounded-2xl p-5 shadow-sm flex justify-between items-start gap-4 transition-all duration-200 group"
            >
              <div className="flex items-start gap-4">
                <span className={`rounded-xl p-3 border shrink-0 ${mod.color}`}>
                  <Icon size={24} />
                </span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-black text-slate-900 group-hover:text-teal-700 transition-colors leading-tight">
                      {mod.title}
                    </h2>
                    {mod.badge && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-teal-50 border border-teal-200 text-teal-800 shrink-0">
                        {mod.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500 max-w-sm">{mod.description}</p>
                </div>
              </div>

              <span className="p-1 rounded-lg bg-slate-50 text-slate-400 group-hover:text-teal-600 group-hover:bg-teal-50 transition-all shrink-0">
                <ChevronRight size={18} />
              </span>
            </Link>
          );
        })}
      </section>

      {/* Rangkuman Tugas & Aktifitas Terbaru */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Kolom Tugas Terkini */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="text-base font-black text-slate-950 flex items-center gap-2">
            <ClipboardList size={18} className="text-teal-700" />
            <span>Tugas Terkini</span>
          </h2>
          
          <div className="space-y-3">
            {tasks.slice(0, 3).length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Tidak ada tugas aktif.</p>
            ) : (
              tasks.slice(0, 3).map((task) => {
                const checks = task.task_checklists || [];
                const doneChecks = checks.filter(c => c.is_done).length;
                return (
                  <div key={task.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 flex justify-between items-center gap-2">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{task.title}</p>
                      <p className="text-[10px] text-slate-400">Prioritas: <span className="font-semibold uppercase text-slate-600">{task.priority}</span></p>
                    </div>
                    {checks.length > 0 && (
                      <span className="text-[9px] font-bold text-slate-500 font-mono px-2 py-0.5 rounded bg-slate-150 shrink-0">
                        {doneChecks}/{checks.length} Checklist
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Kolom Absensi Terkini */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="text-base font-black text-slate-950 flex items-center gap-2">
            <Clock size={18} className="text-teal-700" />
            <span>Kehadiran Terkini</span>
          </h2>

          <div className="space-y-3">
            {attendances.slice(0, 3).length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Belum ada catatan kehadiran.</p>
            ) : (
              attendances.slice(0, 3).map((record) => (
                <div key={record.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 flex justify-between items-center gap-2">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-850">{formatDate(record.attendance_date)}</p>
                    <p className="text-[10px] text-slate-400">
                      {record.attendance_type === "present" 
                        ? `Masuk: ${formatTime(record.check_in_at)} | Pulang: ${formatTime(record.check_out_at)}` 
                        : `Keterangan: ${record.attendance_type === "sick" ? "Sakit" : "Izin"}`}
                    </p>
                  </div>
                  <AttendanceStatusBadge status={record.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
