import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { getInternCards } from "@/features/tasks/queries";
import { getInternDailyReports } from "@/features/daily-reports/queries";
import { getInternAttendances } from "@/features/attendance/queries";
import { AttendanceStatusBadge } from "@/features/attendance/AttendanceStatusBadge";
import { ReportStatusBadge } from "@/features/daily-reports/ReportStatusBadge";
import Link from "next/link";
import { 
  User, Calendar, Briefcase, GraduationCap, MapPin, 
  ArrowLeft, CheckSquare, Clock, FileText, CheckCircle, 
  XCircle, AlertTriangle
} from "lucide-react";

type Props = {
  params: Promise<{ id: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

function formatTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { timeStyle: "short" }).format(new Date(value));
}

export default async function InternProfileDetailPage({ params }: Props) {
  const { id: userId } = await params;
  const db = await createUteroAcademyServiceRoleClient();

  // 1. Fetch user profile
  const { data: userProfile } = await db
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (!userProfile) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="surface p-8 text-center border border-red-200 bg-red-50/50 rounded-xl">
          <p className="text-red-600 font-bold">User tidak ditemukan.</p>
          <Link href="/dashboard/super-admin/users" className="button-primary mt-4 inline-block">
            Kembali ke Daftar
          </Link>
        </div>
      </main>
    );
  }

  // 2. Fetch intern profile with school
  const { data: internProfile } = await db
    .from("intern_profiles")
    .select("*, schools(name)")
    .eq("user_id", userId)
    .maybeSingle();

  if (!internProfile) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="surface p-8 text-center border border-amber-200 bg-amber-50/50 rounded-xl">
          <p className="text-amber-800 font-bold">User ini tidak memiliki profil anak magang (Intern Profile).</p>
          <p className="text-xs text-slate-500 mt-2">Pastikan user memiliki role intern untuk melihat statistik.</p>
          <Link href="/dashboard/super-admin/users" className="button-primary mt-4 inline-block">
            Kembali ke Daftar
          </Link>
        </div>
      </main>
    );
  }

  const schoolObj = Array.isArray(internProfile.schools) ? internProfile.schools[0] : internProfile.schools;
  const schoolName = schoolObj?.name || "Tidak ditentukan";

  // 3. Fetch logs
  const { data: tasks } = await getInternCards(internProfile.id);
  const { data: reports } = await getInternDailyReports(internProfile.id);
  const { data: attendances } = await getInternAttendances(internProfile.id);

  // 4. Calculations
  const totalTasks = tasks.length;
  // Tasks are completed if they have no incomplete subtasks and checklists
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

  const totalLogs = attendances.length;
  const presentDays = attendances.filter(a => a.attendance_type === "present").length;
  const permitDays = attendances.filter(a => a.attendance_type === "permit").length;
  const sickDays = attendances.filter(a => a.attendance_type === "sick").length;

  // Attendance rate (present / total logs)
  const attendanceRate = totalLogs > 0 ? Math.round((presentDays / totalLogs) * 100) : 100;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Back Button */}
      <div className="mb-6">
        <Link href="/dashboard/super-admin/users" className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 text-sm font-semibold transition-all">
          <ArrowLeft size={16} />
          <span>Kembali ke Manajemen User</span>
        </Link>
      </div>

      {/* Intern Profile Card */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex gap-4 items-start">
          <div className="h-16 w-16 rounded-full bg-teal-100 flex items-center justify-center text-teal-800 font-black text-2xl uppercase border border-teal-200 shrink-0">
            {internProfile.full_name.charAt(0)}
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-slate-950 leading-tight">{internProfile.full_name}</h1>
            <p className="text-sm font-medium text-slate-500">{userProfile.email}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 mt-2 font-medium">
              <span className="flex items-center gap-1">
                <GraduationCap size={14} className="text-slate-400" />
                <span>{schoolName}</span>
              </span>
              <span className="flex items-center gap-1">
                <Briefcase size={14} className="text-slate-400" />
                <span>{internProfile.major || "Jurusan -"}</span>
              </span>
              <span className="flex items-center gap-1 font-mono">
                <span>WA/Telp: {internProfile.phone || "-"}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0 self-stretch md:self-auto border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
          <span className="text-xs text-slate-400 font-bold uppercase block text-right">Status Keaktifan</span>
          <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${
            internProfile.status === "active" 
              ? "bg-teal-50 border-teal-200 text-teal-800" 
              : "bg-slate-50 border-slate-200 text-slate-500"
          }`}>
            {internProfile.status === "active" ? "Aktif Magang" : "Selesai / Alumni"}
          </span>
          <p className="text-[10px] text-slate-400 mt-1 font-mono">Terdaftar: {formatDate(internProfile.created_at)}</p>
        </div>
      </section>

      {/* Rangkuman Statistik / KPI */}
      <section className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
          <span className="rounded-lg bg-teal-50 p-2 text-teal-700 inline-block">
            <CheckSquare size={18} />
          </span>
          <p className="text-xs text-slate-400 font-bold uppercase">Skala Kemajuan Tugas</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{completedTasks}</span>
            <span className="text-xs text-slate-400 font-bold">/ {totalTasks} selesai</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
          <span className="rounded-lg bg-indigo-50 p-2 text-indigo-700 inline-block">
            <Clock size={18} />
          </span>
          <p className="text-xs text-slate-400 font-bold uppercase">Rasio Kehadiran</p>
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
            <span className="text-xs text-slate-400 font-bold">terkirim</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
          <span className="rounded-lg bg-red-50 p-2 text-red-700 inline-block">
            <AlertTriangle size={18} />
          </span>
          <p className="text-xs text-slate-400 font-bold uppercase">Izin / Sakit</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{permitDays + sickDays}</span>
            <span className="text-xs text-slate-400 font-bold">{permitDays} Izin, {sickDays} Sakit</span>
          </div>
        </div>
      </section>

      {/* Main Tabs Container */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Kolom 1: Progress Tugas & Absensi */}
        <div className="space-y-6">
          {/* Riwayat Absensi */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950 mb-4 flex items-center gap-2">
              <Clock className="text-teal-700" size={20} />
              <span>Riwayat Absensi Harian</span>
            </h2>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {attendances.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">Belum ada riwayat absensi.</p>
              ) : (
                attendances.map((record) => {
                  const isPresent = record.attendance_type === "present";
                  return (
                    <div key={record.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 flex justify-between items-center gap-2 text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{formatDate(record.attendance_date)}</p>
                        {isPresent ? (
                          <p className="text-slate-500 font-medium mt-0.5">
                            Masuk: {formatTime(record.check_in_at)} | Pulang: {formatTime(record.check_out_at)}
                          </p>
                        ) : (
                          <p className="text-amber-800 font-semibold mt-0.5 italic">
                            Keterangan: {record.attendance_type === "sick" ? "Sakit" : "Izin"} - "{record.permit_reason}"
                          </p>
                        )}
                      </div>
                      <AttendanceStatusBadge status={record.status} />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Kolom Tugas / Task Board Summary */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950 mb-4 flex items-center gap-2">
              <CheckSquare className="text-teal-700" size={20} />
              <span>Daftar Tugas Aktif</span>
            </h2>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {tasks.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">Belum ada tugas didelegasikan.</p>
              ) : (
                tasks.map((task) => {
                  const checklists = task.task_checklists || [];
                  const doneChecks = checklists.filter(c => c.is_done).length;
                  
                  return (
                    <div key={task.id} className="p-3.5 border border-slate-100 rounded-xl bg-slate-50/50 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-slate-900 text-xs leading-tight">{task.title}</h3>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase shrink-0 border ${
                          task.priority === "high" 
                            ? "bg-red-50 border-red-200 text-red-700" 
                            : task.priority === "medium"
                            ? "bg-amber-50 border-amber-300 text-amber-800"
                            : "bg-slate-100 border-slate-300 text-slate-600"
                        }`}>
                          {task.priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{task.description || "Tidak ada deskripsi."}</p>
                      
                      {checklists.length > 0 && (
                        <div className="flex items-center gap-2 pt-1.5 border-t border-slate-100/50">
                          <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-teal-600 h-full rounded-full transition-all" 
                              style={{ width: `${(doneChecks / checklists.length) * 100}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-bold text-slate-500 shrink-0 font-mono">
                            {doneChecks}/{checklists.length} Checklist
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Kolom 2: Laporan Harian (Daily Reports) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
          <h2 className="text-lg font-black text-slate-950 mb-4 flex items-center gap-2">
            <FileText className="text-teal-700" size={20} />
            <span>Laporan Harian (Daily Reports)</span>
          </h2>

          <div className="space-y-4 max-h-[760px] overflow-y-auto pr-1 flex-1">
            {reports.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-12">Belum ada laporan harian dikirim.</p>
            ) : (
              reports.map((report) => (
                <div key={report.id} className="p-4 border border-slate-150 rounded-xl bg-slate-50/50 space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-800">{formatDate(report.report_date)}</span>
                    <ReportStatusBadge status={report.status} />
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="font-bold text-[10px] text-slate-400 uppercase">Pekerjaan Hari Ini</span>
                      <p className="text-slate-700 whitespace-pre-wrap leading-relaxed mt-0.5">{report.today_work}</p>
                    </div>
                    {report.progress && (
                      <div>
                        <span className="font-bold text-[10px] text-slate-400 uppercase">Progress</span>
                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed mt-0.5">{report.progress}</p>
                      </div>
                    )}
                    {report.blockers && (
                      <div className="bg-red-50/50 p-2 rounded-lg border border-red-100">
                        <span className="font-bold text-[10px] text-red-500 uppercase">Kendala / Masalah</span>
                        <p className="text-red-700 whitespace-pre-wrap leading-relaxed mt-0.5">{report.blockers}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
