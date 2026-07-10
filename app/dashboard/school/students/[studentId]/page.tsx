export const dynamic = "force-dynamic";

﻿import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSchoolProfile, getSchoolStudentDetail } from "@/features/school/queries";
import { StatsVisualization } from "@/features/dashboard/StatsVisualization";

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
}
function getPeriodInfo(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) return { progress: 0, daysRemaining: null, totalDays: null, elapsedDays: null, isFinished: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const dayMs = 1000 * 60 * 60 * 24;
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / dayMs) + 1);
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.ceil((today.getTime() - start.getTime()) / dayMs) + 1));
  const daysRemaining = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / dayMs));
  const progress = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
  return { progress, daysRemaining, totalDays, elapsedDays, isFinished: today.getTime() > end.getTime() };
}

export default async function SchoolStudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: schoolProfile } = await getSchoolProfile(user.id);
  if (!schoolProfile) redirect("/dashboard/school");

  const { data: detail } = await getSchoolStudentDetail(schoolProfile.id, studentId);
  if (!detail) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">Data siswa tidak ditemukan.</div>
      </main>
    );
  }

  const { intern } = detail;
  const periodInfo = getPeriodInfo(intern.start_date, intern.end_date);

  const presentDays = detail.attendances.filter(a => a.attendance_type === "present" || !a.attendance_type).length;
  const attendanceBreakdownData = [
    { label: "Hadir", value: presentDays },
    { label: "Izin", value: detail.permitCount },
    { label: "Sakit", value: detail.sickCount },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">School Portal</p>
          <h1 className="text-2xl font-bold text-slate-900">{intern.full_name}</h1>
          <p className="text-sm text-slate-500">{schoolProfile.name}</p>
        </div>
        <Link href="/dashboard/school/students" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Kembali</Link>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-teal-700">Masa Magang</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">{formatDate(intern.start_date)} - {formatDate(intern.end_date)}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {periodInfo.totalDays
                ? `${periodInfo.elapsedDays} dari ${periodInfo.totalDays} hari berjalan`
                : "Periode magang belum diatur."}
            </p>
          </div>
          <div className="min-w-[240px] rounded-xl bg-slate-50 p-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Progress Periode</span>
              <span>{periodInfo.progress}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-teal-600" style={{ width: `${periodInfo.progress}%` }} />
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-600">
              {periodInfo.isFinished
                ? "Masa magang selesai"
                : periodInfo.daysRemaining !== null
                ? `${periodInfo.daysRemaining} hari tersisa`
                : "Periode belum lengkap"}
            </p>
          </div>
        </div>
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Attendance</p><p className="mt-2 text-2xl font-bold text-slate-900">{detail.attendanceRate}%</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Total Jam</p><p className="mt-2 text-2xl font-bold text-slate-900">{detail.totalHours}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Izin</p><p className="mt-2 text-2xl font-bold text-slate-900">{detail.permitCount}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Sakit</p><p className="mt-2 text-2xl font-bold text-slate-900">{detail.sickCount}</p></div>
      </section>

      {/* Chart Visualisasi Stats */}
      <section className="mt-6">
        <StatsVisualization 
          title="Distribusi Absensi Kehadiran Siswa" 
          subtitle="Total hari kehadiran, izin, dan sakit selama magang" 
          data={attendanceBreakdownData} 
          type="bar" 
          color="#CE181E" 
          height={180}
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Profil</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Email</dt><dd className="text-slate-900">{intern.email || "-"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Jurusan</dt><dd className="text-slate-900">{intern.major || "-"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Jenjang</dt><dd className="text-slate-900">{intern.grade_or_semester || "-"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Tanggal Mulai</dt><dd className="text-slate-900">{formatDate(intern.start_date)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Tanggal Selesai</dt><dd className="text-slate-900">{formatDate(intern.end_date)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Nilai Akhir</dt><dd className="text-slate-900">{intern.assessment?.final_score ?? "-"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Sertifikat</dt><dd className="text-slate-900">{intern.certificate?.certificate_number ?? "-"}</dd></div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Status & Ringkasan</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {intern.full_name} saat ini berstatus <span className="font-semibold text-slate-900">{intern.status}</span>. Detail attendance dan daily report dapat ditinjau untuk evaluasi mingguan atau bulanan.
          </p>
          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Attendance rate: <span className="font-semibold text-slate-900">{detail.attendanceRate}%</span><br />
            Total jam: <span className="font-semibold text-slate-900">{detail.totalHours}</span><br />
            Manual review: <span className="font-semibold text-slate-900">{detail.lateCount}</span>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Riwayat Kehadiran Terbaru</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Tanggal</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Masuk</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Pulang</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {detail.attendances.slice(0, 10).map((attendance) => (
                <tr key={attendance.id}>
                  <td className="px-4 py-3 text-slate-700">{formatDate(attendance.attendance_date)}</td>
                  <td className="px-4 py-3 text-slate-700">{attendance.check_in_at ? new Date(attendance.check_in_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{attendance.check_out_at ? new Date(attendance.check_out_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{attendance.status}</td>
                </tr>
              ))}
              {detail.attendances.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Belum ada data kehadiran.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

