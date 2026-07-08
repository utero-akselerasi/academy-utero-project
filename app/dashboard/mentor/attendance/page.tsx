import { AttendanceStatusBadge } from "@/features/attendance/AttendanceStatusBadge";
import { ReviewAttendanceForm } from "@/features/attendance/ReviewAttendanceForm";
import { AttendanceMap } from "@/features/attendance/AttendanceMap";
import { DatePickerFilter } from "@/features/attendance/DatePickerFilter";
import { ImagePreview } from "@/features/daily-reports/ImagePreview";
import { saveAttendanceSettingsAction } from "@/features/attendance/actions";
import { createSupabaseServerClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Clock, Settings, User, X, CheckCircle, AlertTriangle, Play, HelpCircle, MapPin, Eye, Download } from "lucide-react";

type Props = {
  searchParams: Promise<{ detailInternId?: string; showSettings?: string; date?: string }>;
};

function formatTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { timeStyle: "short" }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

export default async function MentorAttendancePage({ searchParams }: Props) {
  const { detailInternId, showSettings, date: filterDate } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = await createUteroAcademyServiceRoleClient();

  // 1. Fetch active settings
  const { data: settings } = await db
    .from("attendance_settings")
    .select("*")
    .eq("id", "00000000-0000-0000-0000-000000000001")
    .maybeSingle();

  const checkInTime = settings?.check_in_time || "08:00";
  const checkOutTime = settings?.check_out_time || "17:00";
  const lateTolerance = settings?.late_tolerance_minutes ?? 15;
  const targetHours = settings?.monthly_target_hours ?? 120;

  // Fetch user ids having role 'intern'
  const { data: internRoleUsers } = await db
    .from("user_roles")
    .select("user_id, roles(code)")
    .returns<any[]>();

  const internUserIds = (internRoleUsers || [])
    .filter(ur => {
      const roleObj = Array.isArray(ur.roles) ? ur.roles[0] : ur.roles;
      return roleObj?.code === "intern";
    })
    .map(ur => ur.user_id);

  // 2. Fetch all active interns having role 'intern'
  const { data: internsData } = await db
    .from("intern_profiles")
    .select("id, full_name, user_id, status, start_date, major, phone, email")
    .eq("status", "active")
    .in("user_id", internUserIds.length > 0 ? internUserIds : ["00000000-0000-0000-0000-000000000000"])
    .order("full_name", { ascending: true });

  const interns = internsData || [];

  // 3. Fetch all attendances
  const { data: attendances } = await db
    .from("attendances")
    .select("*")
    .order("attendance_date", { ascending: false });

  // 4. Calculate stats for each intern
  const [setHour, setMin] = checkInTime.split(":").map(Number);

  const mappedInterns = interns.map(intern => {
    const internLogs = (attendances || []).filter(a => a.intern_id === intern.id);
    
    // Duration of internship in days
    const durationDays = intern.start_date 
      ? Math.max(1, Math.ceil((new Date().getTime() - new Date(intern.start_date).getTime()) / (1000 * 60 * 60 * 24))) 
      : 0;

    let lateCount = 0;
    let totalHours = 0;
    
    internLogs.forEach(log => {
      // Late check
      if (log.attendance_type === "present" && log.check_in_at) {
        const checkInDate = new Date(log.check_in_at);
        const checkInHour = checkInDate.getHours();
        const checkInMin = checkInDate.getMinutes();
        const minutesPastLimit = (checkInHour * 60 + checkInMin) - (setHour * 60 + setMin);
        if (minutesPastLimit > lateTolerance) {
          lateCount++;
        }
      }

      // Cumulative hours calculation
      if (log.attendance_type === "present" && log.check_in_at && log.check_out_at) {
        const diffMs = new Date(log.check_out_at).getTime() - new Date(log.check_in_at).getTime();
        const hours = diffMs / (1000 * 60 * 60);
        totalHours += Math.max(0, parseFloat(hours.toFixed(2)));
      }
    });

    const presentCount = internLogs.filter(l => l.attendance_type === "present" && (l.status === "valid" || l.status === "pending")).length;
    const permitCount = internLogs.filter(l => l.attendance_type === "permit").length;
    const sickCount = internLogs.filter(l => l.attendance_type === "sick").length;
    
    const totalValid = presentCount + permitCount + sickCount;

    // Hitung hari kerja efektif mengecualikan hari minggu
    let workDaysRequired = 0;
    if (intern.start_date) {
      const start = new Date(intern.start_date);
      const end = new Date();
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getDay() !== 0) { // 0 adalah hari Minggu
          workDaysRequired++;
        }
      }
    }
    workDaysRequired = Math.max(1, workDaysRequired);
    const attendanceRate = Math.round((totalValid / workDaysRequired) * 100);

    // Hitung total jam di bulan aktif saat ini
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    let totalHoursThisMonth = 0;
    internLogs.forEach(log => {
      if (log.attendance_date.startsWith(currentMonthStr)) {
        if (log.attendance_type === "present" && log.check_in_at && log.check_out_at) {
          const diffMs = new Date(log.check_out_at).getTime() - new Date(log.check_in_at).getTime();
          const hours = diffMs / (1000 * 60 * 60);
          totalHoursThisMonth += Math.max(0, parseFloat(hours.toFixed(2)));
        }
      }
    });


    // Get latest check-in photo as selfie preview
    const latestSelfie = internLogs.find(l => l.check_in_selfie_path)?.check_in_selfie_path || null;

    return {
      ...intern,
      durationDays,
      lateCount,
      totalHours: parseFloat(totalHours.toFixed(1)),
      totalHoursThisMonth: parseFloat(totalHoursThisMonth.toFixed(1)),
      attendanceRate,
      latestSelfie,
      logs: internLogs
    };
  });

  const selectedIntern = (detailInternId ? mappedInterns.find(i => i.id === detailInternId) : undefined) as any;
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 relative">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Kelola & Review Absensi</h1>
          <p className="mt-2 max-w-2xl leading-7 text-slate-600">
            Peninjauan kehadiran, kalkulasi rata-rata kehadiran, jam magang, dan toleransi keterlambatan anak magang.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Tanggal */}
          <DatePickerFilter actionUrl="/dashboard/mentor/attendance" defaultValue={filterDate || ""} detailInternId={detailInternId} showSettings={showSettings} />

          <Link
            href={showSettings ? "/dashboard/mentor/attendance" : "/dashboard/mentor/attendance?showSettings=true"}
            className="button-secondary text-xs font-bold py-2 px-3 min-h-0 flex items-center gap-1.5 border border-slate-200"
          >
            <Settings size={14} />
            <span>{showSettings ? "Tutup Pengaturan" : "Pengaturan Jam Kerja"}</span>
          </Link>
        </div>
      </div>

      <section className="surface mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Export Rekap</p>
            <h2 className="text-lg font-bold text-slate-950">Download absensi CSV</h2>
            <p className="text-sm text-slate-600">Rekap berisi hadir, total jam, target bulanan, telat, izin, dan sakit/tidak masuk.</p>
          </div>
        </div>
        <form action="/dashboard/mentor/attendance/export" method="get" className="grid gap-3 md:grid-cols-5 md:items-end">
          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700">Mode Export</label>
            <select name="mode" defaultValue="monthly" className="form-input text-xs">
              <option value="monthly">Bulanan</option>
              <option value="range">Custom Range</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700">Bulan</label>
            <input type="month" name="month" defaultValue={currentMonth} className="form-input text-xs" />
          </div>
          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700">Tanggal Mulai</label>
            <input type="date" name="start" defaultValue={today} className="form-input text-xs" />
          </div>
          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700">Tanggal Selesai</label>
            <input type="date" name="end" defaultValue={today} className="form-input text-xs" />
          </div>
          <button type="submit" className="button-primary flex min-h-0 items-center justify-center gap-2 px-4 py-2 text-xs font-bold">
            <Download size={14} />
            Export CSV
          </button>
        </form>
        <p className="mt-3 text-xs text-slate-500">Untuk mode bulanan, sistem memakai input bulan. Untuk custom range, sistem memakai tanggal mulai dan selesai.</p>
      </section>

      {/* Settings Panel */}
      {showSettings === "true" && (
        <form action={saveAttendanceSettingsAction} className="surface p-5 bg-white border border-slate-200 rounded-xl mb-6 grid gap-4 md:grid-cols-4 items-end animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700">Jam Masuk (Check-In) *</label>
            <input
              type="text"
              name="checkInTime"
              defaultValue={checkInTime}
              placeholder="08:00"
              required
              className="form-input text-xs"
            />
          </div>
          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700">Jam Pulang (Check-Out) *</label>
            <input
              type="text"
              name="checkOutTime"
              defaultValue={checkOutTime}
              placeholder="17:00"
              required
              className="form-input text-xs"
            />
          </div>
          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700">Toleransi Terlambat (Menit) *</label>
            <input
              type="number"
              name="lateTolerance"
              defaultValue={lateTolerance}
              required
              className="form-input text-xs"
            />
          </div>
          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700">Target Magang (Jam/Bulan) *</label>
            <input
              type="number"
              name="monthlyTarget"
              defaultValue={targetHours}
              required
              className="form-input text-xs"
            />
          </div>

          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700">Latitude Kantor</label>
            <input
              type="text"
              name="officeLatitude"
              defaultValue={settings?.office_latitude ?? -7.9671}
              required
              className="form-input text-xs"
            />
          </div>
          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700">Longitude Kantor</label>
            <input
              type="text"
              name="officeLongitude"
              defaultValue={settings?.office_longitude ?? 112.6375}
              required
              className="form-input text-xs"
            />
          </div>
          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700">Radius Absensi (Meter)</label>
            <input
              type="number"
              name="radiusMeters"
              defaultValue={settings?.radius_meters ?? 100}
              required
              className="form-input text-xs"
            />
          </div>
          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700">Aktifkan Geofencing GPS</label>
            <select
              name="allowGeofencing"
              defaultValue={settings?.allow_geofencing ? "true" : "false"}
              className="border border-slate-200 rounded-lg text-xs px-2 bg-white h-9 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-slate-850 font-bold w-full"
            >
              <option value="false">Nonaktifkan</option>
              <option value="true">Aktifkan</option>
            </select>
          </div>

          <div className="md:col-span-4 flex justify-end">
            <button type="submit" className="button-primary text-xs py-2 px-4 min-h-0 font-bold">
              Simpan Pengaturan
            </button>
          </div>
        </form>
      )}

      {/* Interns Grid View */}
      <h2 className="mb-4 text-lg font-bold text-slate-950">Peserta Magang Aktif ({interns.length})</h2>
      
      {mappedInterns.length === 0 ? (
        <div className="surface p-8 text-center text-slate-500">
          Belum ada anak magang aktif.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {mappedInterns.map((intern) => {
            return (
              <article key={intern.id} className="surface p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all flex flex-col justify-between items-center text-center gap-3">
                <div className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100 flex items-center justify-center shrink-0">
                  {intern.latestSelfie ? (
                    <img src={intern.latestSelfie} alt={intern.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <User size={36} className="text-slate-400" />
                  )}
                </div>

                <div className="min-w-0">
                  <h3 className="font-extrabold text-slate-900 text-sm truncate">{intern.full_name}</h3>
                  {intern.major ? (
                    <p className="text-[10px] text-teal-700 font-bold truncate mt-0.5">{intern.major}</p>
                  ) : <div className="h-4" />}
                </div>

                <div className="grid grid-cols-3 gap-1.5 w-full bg-slate-50 p-2 rounded-lg border border-slate-100 text-[10px] font-bold text-slate-500">
                  <div>
                    <span className="block text-slate-400 text-[8px] uppercase">Rate</span>
                    <span className="text-teal-700">{intern.attendanceRate}%</span>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-[8px] uppercase">Late</span>
                    <span className="text-red-600">{intern.lateCount}x</span>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-[8px] uppercase">Hours</span>
                    <span className="text-slate-800">{intern.totalHours}h</span>
                  </div>
                </div>

                <Link
                  href={`/dashboard/mentor/attendance?detailInternId=${intern.id}`}
                  className="button-secondary text-xs w-full py-1.5 min-h-0 font-bold flex items-center justify-center gap-1 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300"
                >
                  <Eye size={12} />
                  <span>Detail Absen</span>
                </Link>
              </article>
            );
          })}
        </div>
      )}

      {/* POPUP DETAIL MODAL ABSENSI INTERN */}
      {selectedIntern && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-black text-slate-900">{selectedIntern.full_name}</h3>
                <p className="text-xs text-teal-700 font-bold">{selectedIntern.major || "No Major"} — {selectedIntern.email}</p>
              </div>
              <Link
                href="/dashboard/mentor/attendance"
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
              >
                <X size={18} />
              </Link>
            </div>

            {/* Isi Modal */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Summary Stats Grid */}
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lama Magang</span>
                  <span className="text-lg font-black text-slate-800 block mt-1">{selectedIntern.durationDays} Hari</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Presensi Rate</span>
                  <span className="text-lg font-black text-teal-700 block mt-1">{selectedIntern.attendanceRate}%</span>
                  <span className={`text-[9px] font-bold uppercase ${
                    selectedIntern.attendanceRate >= 90 ? "text-teal-700" : selectedIntern.attendanceRate >= 75 ? "text-blue-700" : "text-red-700"
                  }`}>
                    {selectedIntern.attendanceRate >= 90 ? "Sangat Baik" : selectedIntern.attendanceRate >= 75 ? "Baik" : "Kurang"}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Keterlambatan</span>
                  <span className="text-lg font-black text-red-600 block mt-1">{selectedIntern.lateCount} Kali</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Jam Kerja</span>
                  <span className="text-lg font-black text-slate-800 block mt-1">{selectedIntern.totalHoursThisMonth} / {targetHours}h</span>
                  <span className="text-[9px] text-slate-400 font-bold block mt-0.5">
                    {targetHours > 0 ? Math.round((selectedIntern.totalHoursThisMonth / targetHours) * 100) : 100}% Target Bulan Ini ({selectedIntern.durationDays} hari kerja)
                  </span>
                </div>
              </div>

              {/* Logs List */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
                  Riwayat Kehadiran Harian {filterDate ? `Tanggal ${formatDate(filterDate)}` : ""}
                </h4>
                
                {(() => {
                  const logs = filterDate 
                    ? selectedIntern.logs.filter((l: any) => l.attendance_date === filterDate)
                    : selectedIntern.logs;

                  if (logs.length === 0) {
                    return <p className="text-xs text-slate-500 italic py-4 text-center">Belum ada riwayat absen.</p>;
                  }

                  return (
                    <div className="space-y-3">
                      {logs.map((log: any) => {
                      const isPresent = log.attendance_type === "present" || !log.attendance_type;
                      return (
                        <div key={log.id} className="p-4 bg-slate-50/50 border border-slate-200 rounded-xl space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <span className="text-xs font-black text-slate-900 block">{formatDate(log.attendance_date)}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[9px] font-black uppercase rounded px-1.5 py-0.5 border ${
                                  log.attendance_type === "permit" 
                                    ? "bg-amber-50 border-amber-200 text-amber-800" 
                                    : log.attendance_type === "sick"
                                    ? "bg-red-50 border-red-200 text-red-800"
                                    : "bg-teal-50 border-teal-200 text-teal-800"
                                }`}>
                                  {log.attendance_type === "permit" ? "Izin" : log.attendance_type === "sick" ? "Sakit" : "Hadir"}
                                </span>
                              </div>
                            </div>
                            <AttendanceStatusBadge status={log.status} />
                          </div>

                          {/* Detail Jam & Foto */}
                          {isPresent ? (
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="space-y-1 bg-white p-2 rounded-lg border border-slate-150">
                                <span className="font-bold text-[10px] text-slate-400 uppercase block">Jam Masuk (Check-In)</span>
                                <p className="font-bold text-slate-800">{formatTime(log.check_in_at)}</p>
                                {log.check_in_selfie_path && (
                                  <div className="mt-2 mb-2">
                                    <span className="font-bold text-[9px] text-slate-400 uppercase block mb-1">Selfie Masuk</span>
                                    <ImagePreview src={log.check_in_selfie_path} alt="Selfie Masuk" className="max-h-24 w-auto object-contain rounded border border-slate-200" />
                                  </div>
                                )}
                                {log.check_in_latitude && (
                                  <>
                                    <p className="text-[10px] text-slate-500 font-mono mt-1">GPS: {log.check_in_latitude.toFixed(5)}, {log.check_in_longitude?.toFixed(5)}</p>
                                    <AttendanceMap latitude={log.check_in_latitude} longitude={log.check_in_longitude!} label="Check-In" />
                                  </>
                                )}
                              </div>
                              <div className="space-y-1 bg-white p-2 rounded-lg border border-slate-150">
                                <span className="font-bold text-[10px] text-slate-400 uppercase block">Jam Pulang (Check-Out)</span>
                                <p className="font-bold text-slate-800">{formatTime(log.check_out_at)}</p>
                                {log.check_out_selfie_path && (
                                  <div className="mt-2 mb-2">
                                    <span className="font-bold text-[9px] text-slate-400 uppercase block mb-1">Selfie Pulang</span>
                                    <ImagePreview src={log.check_out_selfie_path} alt="Selfie Pulang" className="max-h-24 w-auto object-contain rounded border border-slate-200" />
                                  </div>
                                )}
                                {log.check_out_latitude && (
                                  <>
                                    <p className="text-[10px] text-slate-500 font-mono mt-1">GPS: {log.check_out_latitude.toFixed(5)}, {log.check_out_longitude?.toFixed(5)}</p>
                                    <AttendanceMap latitude={log.check_out_latitude} longitude={log.check_out_longitude!} label="Check-Out" />
                                  </>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2 text-xs">
                              <div>
                                <span className="font-bold text-[10px] text-slate-400 uppercase block">Alasan Pengajuan</span>
                                <p className="text-slate-700 italic mt-0.5">"{log.permit_reason}"</p>
                              </div>
                              {log.sick_certificate_path && (
                                <div>
                                  <span className="font-bold text-[10px] text-slate-400 uppercase block mb-1">Surat Dokter</span>
                                  <ImagePreview src={log.sick_certificate_path} alt="Surat Dokter" className="max-h-36 object-contain rounded border border-slate-200" />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Form Review Absen */}
                          <ReviewAttendanceForm attendanceId={log.id} currentStatus={log.status} />
                        </div>
                      );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
              <Link
                href="/dashboard/mentor/attendance"
                className="button-secondary text-sm font-semibold"
              >
                Tutup
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


