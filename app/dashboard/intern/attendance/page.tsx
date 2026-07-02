import { CheckInForm } from "@/features/attendance/CheckInForm";
import { CheckOutForm } from "@/features/attendance/CheckOutForm";
import { PermitForm } from "@/features/attendance/PermitForm";
import { getInternAttendances, getTodayAttendance } from "@/features/attendance/queries";
import { getInternProfileId } from "@/features/daily-reports/queries";
import { AttendanceStatusBadge } from "@/features/attendance/AttendanceStatusBadge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

type Props = {
  searchParams: Promise<{ mode?: string }>;
};

function formatTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { timeStyle: "short" }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

export default async function InternAttendancePage({ searchParams }: Props) {
  const { mode = "present" } = await searchParams;
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
  const isPermitOrSick = todayData?.attendance_type === "permit" || todayData?.attendance_type === "sick";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase text-teal-700">Peserta</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Absensi Harian</h1>
        <p className="mt-2 max-w-2xl leading-7 text-slate-600">
          Lakukan check-in dan check-out menggunakan data lokasi GPS perangkat, foto selfie, atau ajukan izin/sakit.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1.5fr]">
        <div>
          {isPermitOrSick ? (
            <div className="surface p-8 text-center bg-amber-50 border border-amber-200 text-amber-900 rounded-xl space-y-4">
              <span className="inline-flex rounded-full bg-amber-100 p-4 text-amber-700 text-xl font-bold">✓</span>
              <h3 className="font-bold text-slate-950">Pengajuan Izin / Sakit</h3>
              <p className="text-sm text-slate-600">
                Anda telah mengajukan izin/sakit untuk hari ini dengan status:
                <span className="font-bold uppercase text-teal-800 ml-1.5 px-2 py-0.5 rounded bg-teal-50 border border-teal-100 text-xs inline-block">
                  {todayData?.attendance_type === "permit" ? "Izin Mandiri" : "Sakit"}
                </span>
              </p>
              <div className="p-3 bg-white border border-amber-100 rounded-lg text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Alasan Keterangan</span>
                <p className="text-xs text-slate-700 italic">"{todayData?.permit_reason}"</p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <span className="text-xs font-bold text-slate-400">Status Review:</span>
                <AttendanceStatusBadge status={todayData?.status || "pending"} />
              </div>
            </div>
          ) : !hasCheckedIn ? (
            <div className="space-y-4">
              <div className="flex bg-slate-200/80 p-1 rounded-lg text-xs font-bold shrink-0">
                <Link
                  href="/dashboard/intern/attendance?mode=present"
                  className={"flex-1 text-center py-2 rounded-md transition-all " + (
                    mode === "present" ? "bg-white text-teal-700 shadow-sm font-black" : "text-slate-600 hover:text-slate-950"
                  )}
                >
                  Absen Hadir
                </Link>
                <Link
                  href="/dashboard/intern/attendance?mode=permit"
                  className={"flex-1 text-center py-2 rounded-md transition-all " + (
                    mode === "permit" ? "bg-white text-teal-700 shadow-sm font-black" : "text-slate-600 hover:text-slate-950"
                  )}
                >
                  Izin / Sakit
                </Link>
              </div>

              {mode === "present" ? <CheckInForm /> : <PermitForm />}
            </div>
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
                    
                    {record.attendance_type === "permit" || record.attendance_type === "sick" ? (
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        {record.attendance_type === "permit" ? (
                          <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-bold uppercase text-[9px]">
                            Izin Mandiri
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-800 font-bold uppercase text-[9px]">
                            Sakit
                          </span>
                        )}
                        
                        {record.sick_certificate_path && (
                          <a href={record.sick_certificate_path} target="_blank" rel="noopener noreferrer" className="text-teal-600 font-bold underline hover:text-teal-800">
                            Lihat Surat Dokter
                          </a>
                        )}
                        
                        {record.permit_reason && (
                          <p className="text-slate-500 italic block mt-0.5">"{record.permit_reason}"</p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1 flex gap-4 text-sm text-slate-600">
                        <span>Masuk: {formatTime(record.check_in_at)}</span>
                        <span>Pulang: {formatTime(record.check_out_at)}</span>
                      </div>
                    )}
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
