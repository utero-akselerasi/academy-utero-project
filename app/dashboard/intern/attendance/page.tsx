import { CheckInForm } from "@/features/attendance/CheckInForm";
import { CheckOutForm } from "@/features/attendance/CheckOutForm";
import { getInternAttendances, getTodayAttendance } from "@/features/attendance/queries";
import { getInternProfileId } from "@/features/daily-reports/queries";
import { AttendanceStatusBadge } from "@/features/attendance/AttendanceStatusBadge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function formatTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { timeStyle: "short" }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

export default async function InternAttendancePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const internProfileId = await getInternProfileId(user.id);
  if (!internProfileId) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="surface p-6 text-sm font-semibold text-red-700">
          Profil peserta belum ditemukan.
        </div>
      </main>
    );
  }
  const todayData = await getTodayAttendance(internProfileId);
  const { data: history } = await getInternAttendances(internProfileId);
  const hasCheckedIn = !!todayData?.check_in_at;
  const hasCheckedOut = !!todayData?.check_out_at;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase text-teal-700">Peserta</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Absensi Harian</h1>
        <p className="mt-2 max-w-2xl leading-7 text-slate-600">
          Lakukan check-in dan check-out menggunakan data lokasi GPS perangkat dan foto selfie.
        </p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_1.5fr]">
        <div>
          {!hasCheckedIn ? (
            <CheckInForm />
          ) : !hasCheckedOut ? (
            <CheckOutForm />
          ) : (
            <div className="surface p-8 text-center">
              <span className="mb-4 inline-flex rounded-full bg-teal-100 p-4 text-teal-700">✓</span>
              <h3 className="font-bold text-slate-950">Selesai Hari Ini</h3>
              <p className="mt-2 text-sm text-slate-600">Kamu sudah melakukan check-out. Sampai jumpa besok!</p>
            </div>
          )}
        </div>
        <div>
          <h2 className="mb-4 text-lg font-bold text-slate-950">Riwayat Absensi</h2>
          <div className="grid gap-3">
            {history.map((record) => (
              <article className="surface p-4 flex flex-col md:flex-row md:items-center justify-between gap-4" key={record.id}>
                <div className="flex gap-4 items-start">
                  <div className="flex flex-col gap-2">
                    {record.check_in_selfie_path && (
                      <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        <img src={record.check_in_selfie_path} alt="Selfie Masuk" className="h-full w-full object-cover" />
                      </div>
                    )}
                    {record.check_out_selfie_path && (
                      <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        <img src={record.check_out_selfie_path} alt="Selfie Pulang" className="h-full w-full object-cover" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-950">{formatDate(record.attendance_date)}</h3>
                    <div className="mt-1 flex gap-4 text-sm text-slate-600">
                      <span>Masuk: {formatTime(record.check_in_at)}</span>
                      <span>Pulang: {formatTime(record.check_out_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <AttendanceStatusBadge status={record.status} />
                  {record.review_note && (
                    <span className="text-xs text-slate-500 italic">" {record.review_note} "</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}