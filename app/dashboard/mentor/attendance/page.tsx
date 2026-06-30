import { getAllAttendances } from "@/features/attendance/queries";
import { AttendanceStatusBadge } from "@/features/attendance/AttendanceStatusBadge";
import { ReviewAttendanceForm } from "@/features/attendance/ReviewAttendanceForm";
import { ImagePreview } from "@/features/daily-reports/ImagePreview";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AttendanceMap } from "@/features/attendance/AttendanceMap";
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

  const { data: records, error } = await getAllAttendances();
  const pendingCount = records.filter(r => r.status === "pending").length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Admin / Pembimbing</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Review Absensi</h1>
          <p className="mt-2 max-w-2xl leading-7 text-slate-600">
            Daftar absensi harian seluruh peserta magang beserta foto selfie. Lakukan verifikasi validitas lokasi dan foto.
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

      {error ? (
        <div className="surface p-4 text-sm font-semibold text-red-700 mb-6">
          Gagal memuat data absensi. Cek koneksi database.
        </div>
      ) : null}

      <div className="grid gap-4">
        {records.length === 0 && !error ? (
          <div className="surface p-8 text-center text-slate-600">
            Belum ada data absensi harian dari peserta magang.
          </div>
        ) : null}

        {records.map((record) => {
          const internName = record.intern_profiles?.full_name ?? "Peserta";
          return (
            <article className="surface p-5 bg-white border border-slate-200 rounded-xl" key={record.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-4 items-start">
                  <div className="flex gap-2">
                    {record.check_in_selfie_path && (
                      <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shrink-0">
                        <ImagePreview 
                          src={record.check_in_selfie_path} 
                          alt={"Selfie Masuk - " + internName} 
                          className="h-full w-full object-cover" 
                        />
                      </div>
                    )}
                    {record.check_out_selfie_path && (
                      <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shrink-0">
                        <ImagePreview 
                          src={record.check_out_selfie_path} 
                          alt={"Selfie Pulang - " + internName} 
                          className="h-full w-full object-cover" 
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-950 text-lg leading-snug">{internName}</h2>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">{formatDate(record.attendance_date)}</p>
                  </div>
                </div>
                <AttendanceStatusBadge status={record.status} />
              </div>
              
              <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                  <p className="font-bold text-slate-950 text-xs">Jam Masuk (Check-In)</p>
                  <p className="mt-0.5 text-sm font-semibold">{formatTime(record.check_in_at)}</p>
                  {record.check_in_latitude && (
                    <>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">GPS: {record.check_in_latitude.toFixed(5)}, {record.check_in_longitude?.toFixed(5)}</p>
                      <AttendanceMap latitude={record.check_in_latitude} longitude={record.check_in_longitude!} label="Check-In" />
                    </>
                  )}
                </div>
                <div>
                  <p className="font-bold text-slate-950 text-xs">Jam Pulang (Check-Out)</p>
                  <p className="mt-0.5 text-sm font-semibold">{formatTime(record.check_out_at)}</p>
                  {record.check_out_latitude && (
                    <>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">GPS: {record.check_out_latitude.toFixed(5)}, {record.check_out_longitude?.toFixed(5)}</p>
                      <AttendanceMap latitude={record.check_out_latitude} longitude={record.check_out_longitude!} label="Check-Out" />
                    </>
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
