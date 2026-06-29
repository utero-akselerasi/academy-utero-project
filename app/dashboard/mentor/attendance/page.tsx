import { getMentorAttendances } from "@/features/attendance/queries";
import { getMentorProfileId } from "@/features/daily-reports/queries";
import { AttendanceStatusBadge } from "@/features/attendance/AttendanceStatusBadge";
import { ReviewAttendanceForm } from "@/features/attendance/ReviewAttendanceForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function formatTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { timeStyle: "short" }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

export default async function MentorAttendancePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const mentorProfileId = await getMentorProfileId(user.id);
  if (!mentorProfileId) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="surface p-6 text-sm font-semibold text-red-700">
          Profil mentor belum ditemukan.
        </div>
      </main>
    );
  }
  const { data: records, error } = await getMentorAttendances(mentorProfileId);
  const pendingCount = records.filter(r => r.status === "pending").length;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Mentor</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Review Absensi</h1>
          <p className="mt-2 max-w-2xl leading-7 text-slate-600">
            Daftar absensi harian peserta bimbingan beserta foto selfie. Lakukan verifikasi validitas lokasi dan foto.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="status-pill">{records.length} data</span>
          {pendingCount > 0 && (
            <span className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">
              {pendingCount} butuh review
            </span>
          )}
        </div>
      </div>
      <div className="grid gap-4">
        {records.map((record) => {
          const internName = record.intern_profiles?.full_name ?? "Peserta";
          return (
            <article className="surface p-5" key={record.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-4 items-start">
                  <div className="flex gap-2">
                    {record.check_in_selfie_path && (
                      <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        <a href={record.check_in_selfie_path} target="_blank" rel="noopener noreferrer">
                          <img src={record.check_in_selfie_path} alt="Selfie Masuk" className="h-full w-full object-cover" />
                        </a>
                      </div>
                    )}
                    {record.check_out_selfie_path && (
                      <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        <a href={record.check_out_selfie_path} target="_blank" rel="noopener noreferrer">
                          <img src={record.check_out_selfie_path} alt="Selfie Pulang" className="h-full w-full object-cover" />
                        </a>
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-950">{internName}</h2>
                    <p className="text-sm text-slate-500">{formatDate(record.attendance_date)}</p>
                  </div>
                </div>
                <AttendanceStatusBadge status={record.status} />
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                <div>
                  <p className="font-bold text-slate-950">Jam Masuk (Check-In)</p>
                  <p>{formatTime(record.check_in_at)}</p>
                  {record.check_in_latitude && (
                    <p className="text-xs text-slate-500 font-mono">GPS: {record.check_in_latitude.toFixed(5)}, {record.check_in_longitude?.toFixed(5)}</p>
                  )}
                </div>
                <div>
                  <p className="font-bold text-slate-950">Jam Pulang (Check-Out)</p>
                  <p>{formatTime(record.check_out_at)}</p>
                  {record.check_out_latitude && (
                    <p className="text-xs text-slate-500 font-mono">GPS: {record.check_out_latitude.toFixed(5)}, {record.check_out_longitude?.toFixed(5)}</p>
                  )}
                </div>
              </div>
              <ReviewAttendanceForm attendanceId={record.id} currentStatus={record.status} />
            </article>
          );
        })}
      </div>
    </main>
  );
}