export const dynamic = "force-dynamic";

import { AttendanceStatusBadge } from "@/features/attendance/AttendanceStatusBadge";
import { PendingPermitsList } from "@/features/attendance/PendingPermitsList";
import { ReviewAttendanceForm } from "@/features/attendance/ReviewAttendanceForm";
import { AttendanceMap } from "@/features/attendance/AttendanceMap";
import { DatePickerFilter } from "@/features/attendance/DatePickerFilter";
import { ImagePreview } from "@/features/daily-reports/ImagePreview";
import { AttendanceSettingsForm } from "@/features/attendance/AttendanceSettingsForm";
import { requireAdmin } from "@/features/auth/guards";
import { getElapsedMonthlyAttendanceTarget, getMonthlyAttendanceTarget } from "@/lib/attendance-calendar";
import { isPdfPath, resolveStorageUrl, resolveStorageUrls } from "@/lib/storage-urls";
import { jakartaDateString, jakartaMinutesOfDay, parseWallClockMinutes } from "@/lib/time";
import Link from "next/link";
import { RouteModal } from "@/components/ui/route-modal";
import { Clock, Settings, User, CheckCircle, AlertTriangle, Play, HelpCircle, MapPin, Eye, Download } from "lucide-react";
import { localAdminAttendanceDashboard } from "@/features/attendance/local";
import { parseAttendanceCoordinates } from "@/features/attendance/coordinates";

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

export default async function AdminAttendancePage({ searchParams }: Props) {
  const { detailInternId, showSettings, date: filterDate } = await searchParams;

  await requireAdmin();

  const dashboard = await localAdminAttendanceDashboard();
  const settings: any = dashboard.settings;
  const interns: any[] = dashboard.interns;
  const attendances: any[] = dashboard.attendances;
  const pendingPermits: any[] = dashboard.pendingPermits;
  const setupRequired = dashboard.setupRequired;

  if (setupRequired) {
    return (
      <main className="w-full px-3 py-4 sm:px-4 sm:py-5">
        <div className="surface p-6 text-sm font-semibold text-red-700">
          Akun admin tidak memiliki akses ke halaman ini.
        </div>
      </main>
    );
  }

  const checkInTime = settings?.check_in_time || "08:00";
  const lateTolerance = settings?.late_tolerance_minutes ?? 15;
  const today = jakartaDateString();
  const currentMonth = today.slice(0, 7);

  // 4. Calculate stats for each intern
  //
  // Default 08:00 dipilih eksplisit kalau kolomnya tidak berbentuk "HH:MM".
  // Sebelumnya `split(":").map(Number)`: isi kolom yang rusak jadi `NaN`, dan
  // perbandingan apa pun terhadap `NaN` bernilai false — artinya jumlah telat
  // yang ditampilkan ke admin akan **selalu nol** tanpa error apa pun.
  const scheduledCheckInMinutes = parseWallClockMinutes(checkInTime) ?? 8 * 60;

  const mappedInterns = interns.map(intern => {
    const internLogs = (attendances || []).filter(a => a.intern_id === intern.id);
    
    let lateCount = 0;
    let totalHours = 0;
    
    internLogs.forEach(log => {
      // Late check
      if (log.attendance_type === "present" && log.check_in_at) {
        // `jakartaMinutesOfDay`, bukan `getHours()`: yang kedua memakai zona
        // waktu proses Node, jadi angka telat di dashboard admin ikut bergeser
        // kalau `TZ` container hilang. Lihat `lib/time.ts`.
        const actualMinutes = jakartaMinutesOfDay(new Date(log.check_in_at));
        const minutesPastLimit = actualMinutes - scheduledCheckInMinutes;
        // `Number.isFinite` menjaga timestamp rusak: `NaN > lateTolerance`
        // bernilai false, jadi sebenarnya sudah aman — pemeriksaan ini ada
        // supaya sifat itu eksplisit, bukan kebetulan.
        if (Number.isFinite(minutesPastLimit) && minutesPastLimit > lateTolerance) {
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

    const hasInternshipStart = Boolean(intern.start_date);
    const monthlyTarget = hasInternshipStart
      ? getMonthlyAttendanceTarget(currentMonth, intern.start_date, intern.end_date) : { workdays: 0, hours: 0 };
    const elapsedTarget = hasInternshipStart
      ? getElapsedMonthlyAttendanceTarget(currentMonth, today, intern.start_date, intern.end_date) : { workdays: 0, hours: 0 };
    const withinWorkPeriod = (date: string) => hasInternshipStart && date.startsWith(currentMonth) && date <= today &&
      date >= intern.start_date && (!intern.end_date || date <= intern.end_date) &&
      new Date(`${date}T00:00:00Z`).getUTCDay() !== 0;
    const presentDays = new Set(internLogs.filter(log => withinWorkPeriod(log.attendance_date) &&
      log.attendance_type === "present" && ["valid", "pending"].includes(log.status)).map(log => log.attendance_date)).size;
    const attendanceRate = elapsedTarget.workdays > 0
      ? Math.min(100, Math.round((presentDays / elapsedTarget.workdays) * 100)) : 0;

    const creditedHoursByDay = new Map<string, number>();
    internLogs.forEach(log => {
      if (withinWorkPeriod(log.attendance_date)) {
        if (log.attendance_type === "present" && ["valid", "pending"].includes(log.status) && log.check_in_at && log.check_out_at) {
          const diffMs = new Date(log.check_out_at).getTime() - new Date(log.check_in_at).getTime();
          const hours = diffMs / (1000 * 60 * 60);
          creditedHoursByDay.set(log.attendance_date, (creditedHoursByDay.get(log.attendance_date) ?? 0) + Math.max(0, hours));
        }
      }
    });
    const totalHoursThisMonth = [...creditedHoursByDay.values()].reduce((total, hours) => total + Math.min(8, hours), 0);
    const monthlyProgressPercent = elapsedTarget.hours > 0
      ? Math.min(100, Math.round((totalHoursThisMonth / elapsedTarget.hours) * 100)) : 0;


    // Object path, BUKAN URL — ditandatangani di bawah, setelah map ini selesai.
    // Penandatanganan tidak bisa dilakukan di sini karena `.map()` ini sinkron.
    const latestSelfiePath = internLogs.find(l => l.check_in_selfie_path)?.check_in_selfie_path || null;

    return {
      ...intern,
      lateCount,
      totalHours: parseFloat(totalHours.toFixed(1)),
      totalHoursThisMonth: parseFloat(totalHoursThisMonth.toFixed(1)),
      monthlyTargetHours: monthlyTarget.hours,
      monthlyWorkdays: monthlyTarget.workdays,
      hasInternshipStart,
      elapsedTargetHours: elapsedTarget.hours,
      elapsedWorkdays: elapsedTarget.workdays,
      presentDays,
      monthlyProgressPercent,
      attendanceRate,
      latestSelfiePath,
      logs: internLogs
    };
  });

  // Semua lampiran absensi ada di bucket privat `academy-private`, jadi butuh signed URL
  // yang dibuat di server.
  //
  // Hanya thumbnail daftar yang ditandatangani untuk SEMUA peserta; empat
  // lampiran per baris log hanya ditandatangani untuk peserta yang dibuka
  // detailnya. Menandatangani seluruh log setiap render akan memanggil Storage
  // sebanyak 4 × jumlah baris absensi seluruh peserta — halaman ini adalah titik
  // render terberat di aplikasi.
  const latestSelfieUrls = await resolveStorageUrls(
    "academy-private",
    mappedInterns.map((intern) => intern.latestSelfiePath),
  );
  const internsWithSelfie = mappedInterns.map((intern, index) => ({
    ...intern,
    latestSelfie: latestSelfieUrls[index],
  }));

  const selectedIntern = (detailInternId ? internsWithSelfie.find(i => i.id === detailInternId) : undefined) as any;

  // Lampiran per baris log, hanya untuk peserta yang sedang dibuka. Di-key per
  // id absensi supaya JSX tidak perlu berurusan dengan indeks.
  const logAttachments = new Map<
    string,
    { checkIn: string | null; checkOut: string | null; proof: string | null; checkOutProof: string | null; sickCertificate: string | null }
  >();
  if (selectedIntern) {
    const logs = (selectedIntern.logs ?? []) as any[];
    const resolved = await Promise.all(
      logs.map(async (log) => ({
        id: log.id as string,
        checkIn: await resolveStorageUrl("academy-private", log.check_in_selfie_path),
        checkOut: await resolveStorageUrl("academy-private", log.check_out_selfie_path),
        proof: await resolveStorageUrl("academy-private", log.out_of_range_proof_path),
        checkOutProof: await resolveStorageUrl("academy-private", log.check_out_out_of_range_proof_path),
        sickCertificate: await resolveStorageUrl("academy-private", log.sick_certificate_path),
      })),
    );
    for (const entry of resolved) {
      logAttachments.set(entry.id, entry);
    }
  }

  // Lampiran izin/sakit yang menunggu approval. `PendingPermitsList` adalah
  // komponen klien, jadi ia tidak bisa menandatangani sendiri — URL dan keputusan
  // PDF-nya disiapkan di sini.
  const permitAttachments: Record<string, { url: string | null; isPdf: boolean }> = {};
  for (const permit of (pendingPermits || []) as any[]) {
    permitAttachments[permit.id as string] = {
      url: await resolveStorageUrl("academy-private", permit.attachment_path),
      isPdf: isPdfPath(permit.attachment_path, "academy-private"),
    };
  }

  // Bukti kegiatan luar bisa PDF atau gambar, dan keputusan itu HARUS diambil
  // dari object path: signed URL berakhir dengan `?token=...`, jadi
  // `.endsWith('.pdf')` pada URL final selalu false dan setiap PDF akan dirender
  // sebagai gambar rusak.
  const proofIsPdf = new Map<string, boolean>();
  const checkOutProofIsPdf = new Map<string, boolean>();
  if (selectedIntern) {
    for (const log of (selectedIntern.logs ?? []) as any[]) {
      proofIsPdf.set(log.id as string, isPdfPath(log.out_of_range_proof_path, "academy-private"));
      checkOutProofIsPdf.set(log.id as string, isPdfPath(log.check_out_out_of_range_proof_path, "academy-private"));
    }
  }
  return (
    <main className="w-full px-3 py-4 sm:px-4 sm:py-5 relative">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Admin</p>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-950">Kelola & Review Absensi</h1>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
            Peninjauan kehadiran, kalkulasi rata-rata kehadiran, jam magang, dan toleransi keterlambatan anak magang.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Tanggal */}
          <DatePickerFilter actionUrl="/dashboard/admin/attendance" defaultValue={filterDate || ""} detailInternId={detailInternId} showSettings={showSettings} />

          <Link
            href={showSettings ? "/dashboard/admin/attendance" : "/dashboard/admin/attendance?showSettings=true"}
            className="button-secondary text-xs font-bold py-2 px-3 min-h-0 flex items-center gap-1.5 border border-slate-200"
          >
            <Settings size={14} />
            <span>{showSettings ? "Tutup Pengaturan" : "Pengaturan Jam Kerja"}</span>
          </Link>
        </div>
      </div>

            <details className="group surface mb-6 rounded-xl border border-slate-200 bg-white overflow-hidden [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-teal-100 p-2 text-teal-800 shrink-0">
              <Download size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-950">Export Rekap Absensi (CSV)</h2>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Download daftar hadir bulanan / custom range.</p>
            </div>
          </div>
          <span className="text-teal-700 text-xs font-bold uppercase tracking-widest hidden sm:block mr-2 group-open:hidden">Buka Export</span>
        </summary>
        
        <div className="p-5 border-t border-slate-200 bg-slate-50/50">
          {/* Setiap `<label>` di halaman ini dulunya tanpa `htmlFor` (temuan #3).
              Label yang tidak terhubung tidak diumumkan saat kontrolnya difokus —
              pembaca layar menyebut "edit text, blank" — dan mengkliknya tidak
              memindahkan fokus ke kontrolnya. */}
          <form action="/dashboard/admin/attendance/export" method="get" className="grid gap-3 md:grid-cols-5 md:items-end">
            <div className="form-field">
              <label className="form-label text-xs font-bold text-slate-700" htmlFor="exportMode">Mode Export</label>
              <select id="exportMode" name="mode" defaultValue="monthly" className="form-input text-xs">
                <option value="monthly">Bulanan</option>
                <option value="range">Custom Range</option>
              </select>
            </div>
            <div className="form-field">
              <label className="form-label text-xs font-bold text-slate-700" htmlFor="exportMonth">Bulan</label>
              <input id="exportMonth" type="month" name="month" defaultValue={currentMonth} className="form-input text-xs" />
            </div>
            <div className="form-field">
              <label className="form-label text-xs font-bold text-slate-700" htmlFor="exportStart">Tanggal Mulai</label>
              <input id="exportStart" type="date" name="start" defaultValue={today} className="form-input text-xs" />
            </div>
            <div className="form-field">
              <label className="form-label text-xs font-bold text-slate-700" htmlFor="exportEnd">Tanggal Selesai</label>
              <input id="exportEnd" type="date" name="end" defaultValue={today} className="form-input text-xs" />
            </div>
            <button type="submit" className="button-primary flex min-h-0 items-center justify-center gap-2 px-4 py-2 text-xs font-bold h-[42px]">
              <Download size={14} aria-hidden="true" />
              Export
            </button>
          </form>
          <p className="mt-3 text-[10px] sm:text-xs text-slate-500 font-medium">Rekap CSV berisi hadir, total jam, target bulanan, telat, izin, dan sakit/tidak masuk.</p>
        </div>
      </details>

      {showSettings === "true" && (
        <div className="mb-6">
          <AttendanceSettingsForm settings={settings} month={currentMonth} />
        </div>
      )}

      {/* Pending Permits List */}
      <PendingPermitsList permits={pendingPermits || []} attachments={permitAttachments} />

      {/* Interns Grid View */}
      <h2 className="mb-4 text-lg font-bold text-slate-950">Peserta Magang Aktif ({interns.length})</h2>
      
      {internsWithSelfie.length === 0 ? (
        <div className="surface p-8 text-center text-slate-500">
          Belum ada anak magang aktif.
        </div>
      ) : (
        <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {internsWithSelfie.map((intern) => {
            return (
              <article key={intern.id} className="surface p-3 sm:p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all flex flex-col justify-between items-center text-center gap-2 sm:gap-3">
                <div className="relative h-12 w-12 sm:h-20 sm:w-20 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100 flex items-center justify-center shrink-0">
                  {intern.latestSelfie ? (
                    <img src={intern.latestSelfie} alt={intern.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <User className="text-slate-400 w-6 h-6 sm:w-9 sm:h-9" />
                  )}
                </div>

                <div className="min-w-0">
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm line-clamp-2 break-words min-h-[2rem] flex items-center justify-center">{intern.full_name}</h3>
                  {intern.major ? (
                    <p className="text-[10px] text-teal-700 font-bold line-clamp-1 break-words mt-0.5">{intern.major}</p>
                  ) : <div className="h-4" />}
                </div>

                <div className="grid grid-cols-2 gap-2 w-full bg-slate-50 p-2 rounded-lg border border-slate-100 text-[10px] sm:text-xs font-semibold text-slate-600">
                  <div>
                    <span className="block text-slate-500 text-[10px]">Hadir / berjalan</span>
                    <span className="text-teal-700">{intern.presentDays} / {intern.elapsedWorkdays} hari</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-[10px]">Kehadiran bulan ini</span>
                    <span className="text-teal-700">{intern.attendanceRate}%</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-[10px]">Jam dihitung / target</span>
                    <span className="text-slate-800">{intern.hasInternshipStart ? `${intern.totalHoursThisMonth} / ${intern.monthlyTargetHours} jam` : "Periode belum diatur"}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-[10px]">Terlambat</span>
                    <span className="text-red-600">{intern.lateCount} kali</span>
                  </div>
                </div>

                <Link
                  href={`/dashboard/admin/attendance?detailInternId=${intern.id}`}
                  className="button-secondary text-[10px] sm:text-xs w-full py-1 sm:py-1.5 min-h-0 font-bold flex items-center justify-center gap-1 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300"
                >
                  <Eye size={12} />
                  <span>Detail Absen</span>
                </Link>
              </article>
            );
          })}
        </div>
      )}

      {/* POPUP DETAIL MODAL ABSENSI INTERN

          Dialog terakhir dari sebelas yang ditemukan audit (temuan #2). Ia
          dikendalikan URL, bukan state: dibuka lewat `?detailInternId=`, dan
          ditutup dengan kembali ke `/dashboard/admin/attendance`.

          Halaman ini server component, jadi ia tidak bisa menyerahkan `onClose`
          ke `Modal` — closure tidak melintasi batas server/klien. `RouteModal`
          menyediakannya di sisi klien dengan menavigasi ke `closeHref`, supaya
          Escape dan klik latar benar-benar MENUTUP dialognya, bukan cuma
          menyembunyikan panel selagi URL-nya masih menunjuk ke dialog terbuka. */}
      {selectedIntern && (
        <RouteModal
          closeHref="/dashboard/admin/attendance"
          title={`Detail absensi ${selectedIntern.full_name}`}
          hideTitle
          closeLabel="Tutup detail absensi"
          panelClassName="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]"
          headerClassName="absolute top-4 right-5 z-10"
          closeClassName="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
        >
          <>
            {/* Header Modal */}
            <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-black text-slate-900">{selectedIntern.full_name}</h3>
                <p className="text-xs text-teal-700 font-bold">{selectedIntern.major || "No Major"} — {selectedIntern.email}</p>
              </div>
            </div>

            {/* Isi Modal */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Hari Kerja Bulan Ini</span>
                  <span className="text-lg font-black text-slate-800 block mt-1">{selectedIntern.elapsedWorkdays} / {selectedIntern.monthlyWorkdays}</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Kehadiran bulan ini</span>
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
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Jam dihitung bulan ini</span>
                  <span className="text-lg font-black text-slate-800 block mt-1">{selectedIntern.hasInternshipStart ? `${selectedIntern.totalHoursThisMonth} / ${selectedIntern.monthlyTargetHours} jam` : "Periode belum diatur"}</span>
                  <span className="text-[10px] text-slate-600 font-semibold block mt-0.5">
                    {selectedIntern.monthlyProgressPercent}% dari {selectedIntern.elapsedTargetHours} jam target berjalan · maksimal 8 jam/hari
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
                      const checkInCoordinates = parseAttendanceCoordinates(log.check_in_latitude, log.check_in_longitude);
                      const checkOutCoordinates = parseAttendanceCoordinates(log.check_out_latitude, log.check_out_longitude);
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
                            <>
                            <div className="grid gap-4 sm:grid-cols-2 text-xs">
                              {/* Jam Masuk */}
                              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                                    <span className="font-extrabold text-[10px] text-slate-400 uppercase tracking-wider">Jam Masuk (Check-In)</span>
                                    <span className="font-extrabold text-xs text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full">{formatTime(log.check_in_at)}</span>
                                  </div>
                                  {logAttachments.get(log.id)?.checkIn && (
                                    <div className="mb-3">
                                      <span className="font-bold text-[9px] text-slate-400 uppercase block mb-1">Selfie Masuk</span>
                                      <ImagePreview src={logAttachments.get(log.id)!.checkIn!} alt="Selfie Masuk" className="max-h-32 w-full object-cover rounded-lg border border-slate-200" />
                                    </div>
                                  )}
                                </div>
                                {checkInCoordinates && (
                                  <div className="border-t border-slate-100 pt-2 mt-auto">
                                    <span className="font-semibold text-[9px] text-slate-400 uppercase block">Lokasi GPS</span>
                                    <p className="text-[10px] text-slate-600 font-mono mt-0.5">Lat: {checkInCoordinates.latitude.toFixed(5)}, {checkInCoordinates.longitude.toFixed(5)}</p>
                                    <AttendanceMap latitude={checkInCoordinates.latitude} longitude={checkInCoordinates.longitude} label="Check-In" />
                                  </div>
                                )}
                              </div>
                              
                              {/* Jam Pulang */}
                              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                                    <span className="font-extrabold text-[10px] text-slate-400 uppercase tracking-wider">Jam Pulang (Check-Out)</span>
                                    <span className="font-extrabold text-xs text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                                      {log.check_out_at ? formatTime(log.check_out_at) : "--:--"}
                                    </span>
                                  </div>
                                  {logAttachments.get(log.id)?.checkOut ? (
                                    <div className="mb-3">
                                      <span className="font-bold text-[9px] text-slate-400 uppercase block mb-1">Selfie Pulang</span>
                                      <ImagePreview src={logAttachments.get(log.id)!.checkOut!} alt="Selfie Pulang" className="max-h-32 w-full object-cover rounded-lg border border-slate-200" />
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center h-28 bg-slate-50 border border-dashed border-slate-200 rounded-lg mb-3">
                                      <span className="text-[10px] text-slate-400 font-medium italic">Belum check-out</span>
                                    </div>
                                  )}
                                </div>
                                {checkOutCoordinates && (
                                  <div className="border-t border-slate-100 pt-2 mt-auto">
                                    <span className="font-semibold text-[9px] text-slate-400 uppercase block">Lokasi GPS</span>
                                    <p className="text-[10px] text-slate-600 font-mono mt-0.5">Lat: {checkOutCoordinates.latitude.toFixed(5)}, {checkOutCoordinates.longitude.toFixed(5)}</p>
                                    <AttendanceMap latitude={checkOutCoordinates.latitude} longitude={checkOutCoordinates.longitude} label="Check-Out" />
                                  </div>
                                )}
                              </div>
                            </div>
                            {log.is_out_of_range && (
                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs mt-2 space-y-2 text-left">
                                <span className="font-bold text-amber-900 block">⚠️ Absen di Luar Jangkauan Kantor</span>
                                <div>
                                  <span className="font-bold text-[10px] text-slate-500 uppercase block">Alasan Kegiatan:</span>
                                  <p className="text-slate-700 italic mt-0.5">"{log.out_of_range_reason}"</p>
                                </div>
                                {logAttachments.get(log.id)?.proof && (
                                  <div>
                                    <span className="font-bold text-[10px] text-slate-500 uppercase block mb-1">Bukti Dokumen:</span>
                                    {/* Dinilai dari object path lewat isPdfPath(), bukan dari URL:
                                        signed URL berakhir `?token=...` jadi .endsWith('.pdf')
                                        selalu false dan PDF akan dirender sebagai gambar rusak. */}
                                    {proofIsPdf.get(log.id) ? (
                                      <a href={logAttachments.get(log.id)!.proof!} target="_blank" rel="noreferrer" className="text-teal-600 font-bold underline hover:text-teal-700 block">
                                        Lihat Dokumen PDF Bukti
                                      </a>
                                    ) : (
                                      <ImagePreview src={logAttachments.get(log.id)!.proof!} alt="Bukti Kegiatan Luar" className="max-h-36 object-contain rounded border border-slate-200" />
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            {log.check_out_is_out_of_range && (
                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs mt-2 space-y-2 text-left">
                                <span className="font-bold text-amber-900 block">Check-out di Luar Jangkauan Kantor</span>
                                <div>
                                  <span className="font-bold text-[10px] text-slate-500 uppercase block">Alasan Kegiatan:</span>
                                  <p className="text-slate-700 italic mt-0.5">"{log.check_out_out_of_range_reason}"</p>
                                </div>
                                {logAttachments.get(log.id)?.checkOutProof && (
                                  <div>
                                    <span className="font-bold text-[10px] text-slate-500 uppercase block mb-1">Bukti Dokumen:</span>
                                    {checkOutProofIsPdf.get(log.id) ? (
                                      <a href={logAttachments.get(log.id)!.checkOutProof!} target="_blank" rel="noreferrer" className="text-teal-600 font-bold underline hover:text-teal-700 block">
                                        Lihat Dokumen PDF Bukti
                                      </a>
                                    ) : (
                                      <ImagePreview src={logAttachments.get(log.id)!.checkOutProof!} alt="Bukti Check-out Kegiatan Luar" className="max-h-36 object-contain rounded border border-slate-200" />
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            </>
                          ) : (
                            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2 text-xs">
                              <div>
                                <span className="font-bold text-[10px] text-slate-400 uppercase block">Alasan Pengajuan</span>
                                <p className="text-slate-700 italic mt-0.5">"{log.permit_reason}"</p>
                              </div>
                              {logAttachments.get(log.id)?.sickCertificate && (
                                <div>
                                  <span className="font-bold text-[10px] text-slate-400 uppercase block mb-1">Surat Dokter</span>
                                  <ImagePreview src={logAttachments.get(log.id)!.sickCertificate!} alt="Surat Dokter" className="max-h-36 object-contain rounded border border-slate-200" />
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
                href="/dashboard/admin/attendance"
                className="button-secondary text-sm font-semibold"
              >
                Tutup
              </Link>
            </div>
          </>
        </RouteModal>
      )}
    </main>
  );
}


