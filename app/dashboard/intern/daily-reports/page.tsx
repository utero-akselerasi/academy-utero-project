import { DailyReportForm } from "@/features/daily-reports/DailyReportForm";
import { getInternDailyReports, getInternProfileId } from "@/features/daily-reports/queries";
import { ReportStatusBadge } from "@/features/daily-reports/ReportStatusBadge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

function isImageAttachment(att: { mime_type?: string | null; file_name: string }) {
  if (att.mime_type && att.mime_type.startsWith("image/")) {
    return true;
  }
  const ext = att.file_name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "");
}

type PageProps = {
  searchParams: Promise<{ editReportId?: string }>;
};

export default async function InternDailyReportsPage({ searchParams }: PageProps) {
  const { editReportId } = await searchParams;
  
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
  
  const { data: reports, error } = await getInternDailyReports(internProfileId);
  
  const editReport = editReportId ? reports.find(r => r.id === editReportId) : undefined;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase text-teal-700">Peserta</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Daily Report</h1>
        <p className="mt-2 max-w-2xl leading-7 text-slate-600">
          Isi laporan harian untuk mencatat pekerjaan, progress, kendala, dan rencana besok beserta lampiran file.
        </p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_1.5fr]">
        <div>
          <h2 className="mb-4 text-lg font-bold text-slate-950">
            {editReport ? "Edit Laporan" : "Kirim Laporan Baru"}
          </h2>
          <DailyReportForm editReport={editReport} />
        </div>
        <div>
          <h2 className="mb-4 text-lg font-bold text-slate-950">
            Riwayat Laporan ({reports.length})
          </h2>
          {reports.map((report) => (
            <article className="surface p-5 bg-white mb-3" key={report.id}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold text-slate-950">{formatDate(report.report_date)}</h3>
                <div className="flex items-center gap-2">
                  {report.status === "revision_requested" && (
                    <Link
                      href={`/dashboard/intern/daily-reports?editReportId=${report.id}`}
                      className="button-secondary text-xs py-1 px-2.5 min-h-0 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold border-teal-200"
                    >
                      Edit Revisi
                    </Link>
                  )}
                  <ReportStatusBadge status={report.status} />
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">{report.today_work}</p>
              {report.progress && (
                <p className="mt-1 text-sm text-slate-500"><span className="font-bold text-slate-700">Progress:</span> {report.progress}</p>
              )}
              {report.blockers && (
                <p className="mt-1 text-sm text-slate-500"><span className="font-bold text-slate-700">Kendala:</span> {report.blockers}</p>
              )}
              {report.tomorrow_plan && (
                <p className="mt-1 text-sm text-slate-500"><span className="font-bold text-slate-700">Rencana:</span> {report.tomorrow_plan}</p>
              )}
              {report.daily_report_attachments && report.daily_report_attachments.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-2">
                  <p className="text-xs font-bold text-slate-500 mb-1">Lampiran File / Link:</p>
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
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
