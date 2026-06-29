
function isImageAttachment(att: { mime_type?: string | null; file_name: string }) {
  if (att.mime_type && att.mime_type.startsWith("image/")) {
    return true;
  }
  const ext = att.file_name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "");
}
﻿import { getMentorDailyReports, getMentorProfileId } from "@/features/daily-reports/queries";
import { ReportStatusBadge } from "@/features/daily-reports/ReportStatusBadge";
import { ReviewReportForm } from "@/features/daily-reports/ReviewReportForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

export default async function MentorDailyReportsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const mentorProfileId = await getMentorProfileId(user.id);

  if (!mentorProfileId) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="surface p-6 text-sm font-semibold text-red-700">
          Profil mentor belum ditemukan. Hubungi admin untuk setup profil.
        </div>
      </main>
    );
  }

  const { data: reports, error } = await getMentorDailyReports(mentorProfileId);

  const pendingCount = reports.filter((r) => r.status === "submitted").length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Mentor</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Review Daily Report</h1>
          <p className="mt-2 max-w-2xl leading-7 text-slate-600">
            Laporan harian dari peserta bimbingan. Setujui atau minta revisi untuk setiap laporan.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="status-pill">{reports.length} laporan</span>
          {pendingCount > 0 ? (
            <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">
              {pendingCount} menunggu review
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="surface p-4 text-sm font-semibold text-red-700">
          Gagal memuat laporan. Cek koneksi database.
        </div>
      ) : null}

      {reports.length === 0 && !error ? (
        <div className="surface p-8 text-center text-slate-600">
          Belum ada laporan dari peserta bimbingan.
        </div>
      ) : null}

      <div className="grid gap-4">
        {reports.map((report) => {
          const internName =
            report.intern_profiles?.user_profiles?.full_name ?? "Peserta";

          return (
            <article className="surface p-5" key={report.id}>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-bold text-slate-950">{internName}</h2>
                <span className="text-sm text-slate-500">{formatDate(report.report_date)}</span>
                <ReportStatusBadge status={report.status} />
              </div>

              <dl className="mt-4 grid gap-3 text-sm text-slate-700">
                <div>
                  <dt className="font-bold text-slate-950">Pekerjaan Hari Ini</dt>
                  <dd className="mt-1 leading-6">{report.today_work}</dd>
                </div>
                {report.progress ? (
                  <div>
                    <dt className="font-bold text-slate-950">Progress</dt>
                    <dd className="mt-1 leading-6">{report.progress}</dd>
                  </div>
                ) : null}
                {report.blockers ? (
                  <div>
                    <dt className="font-bold text-slate-950">Kendala</dt>
                    <dd className="mt-1 leading-6">{report.blockers}</dd>
                  </div>
                ) : null}
                {report.tomorrow_plan ? (
                  <div>
                    <dt className="font-bold text-slate-950">Rencana Besok</dt>
                    <dd className="mt-1 leading-6">{report.tomorrow_plan}</dd>
                  </div>
                ) : null}
              </dl>

              {report.daily_report_attachments && report.daily_report_attachments.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
                  <p className="font-bold text-slate-950 mb-1">Lampiran File / Link:</p>
                  <div className="grid gap-2">
                    {report.daily_report_attachments.map((att) => {
                      const isImg = isImageAttachment(att);
                      const isDrive = att.file_path.includes("google.com") || att.file_path.includes("drive.google.com");
                      return (
                        <div key={att.id} className="mt-1">
                          {isImg ? (
                            <div className="max-w-xs">
                              <p className="text-xs text-slate-400 mb-1">{att.file_name}:</p>
                              <a href={att.file_path} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 hover:opacity-90 bg-slate-50 p-1">
                                <img src={att.file_path} alt={att.file_name} className="max-h-36 w-auto object-contain mx-auto" />
                              </a>
                            </div>
                          ) : (
                            <a href={att.file_path} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-700 font-bold hover:underline flex items-center gap-1">
                              {isDrive ? "??" : "??"} {att.file_name} {isDrive ? "(Google Drive)" : ""}
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <ReviewReportForm currentStatus={report.status} reportId={report.id} />
            </article>
          );
        })}
      </div>
    </main>
  );
}
