import { ImagePreview } from "@/features/daily-reports/ImagePreview";
import { DailyReportForm } from "@/features/daily-reports/DailyReportForm";
import { getInternDailyReports, getInternProfileId } from "@/features/daily-reports/queries";
import { ReportStatusBadge } from "@/features/daily-reports/ReportStatusBadge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Eye, Edit3, X } from "lucide-react";

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
  searchParams: Promise<{ editReportId?: string; detailReportId?: string; status?: string }>;
};

export default async function InternDailyReportsPage({ searchParams }: PageProps) {
  const { editReportId, detailReportId, status: statusFilter } = await searchParams;
  
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
  if (error) {
    console.error("=== DEBUG INTERN DAILY REPORT ERROR ===", error);
  }
  
  // Filter laporan berdasarkan status
  const currentFilter = statusFilter || "all";
  const filteredReports = currentFilter === "all" 
    ? reports 
    : reports.filter(r => r.status === currentFilter);

  const editReport = editReportId ? reports.find(r => r.id === editReportId) : undefined;
  const detailReport = detailReportId ? reports.find(r => r.id === detailReportId) : undefined;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 relative">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase text-teal-700">Peserta</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Daily Report</h1>
        <p className="mt-2 max-w-2xl leading-7 text-slate-600">
          Isi laporan harian untuk mencatat pekerjaan, progress, kendala, dan rencana besok beserta lampiran file.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.8fr]">
        {/* Kiri: Form Input/Edit */}
        <div>
          <h2 className="mb-4 text-lg font-bold text-slate-950">
            {editReport ? "Edit Laporan" : "Kirim Laporan Baru"}
          </h2>
          <DailyReportForm editReport={editReport} />
        </div>

        {/* Kanan: Riwayat Laporan Minimalis */}
        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-3">
            <h2 className="text-lg font-bold text-slate-950">
              Riwayat Laporan ({filteredReports.length})
            </h2>
            {/* Filter Status Tabs */}
            <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg text-xs">
              {[
                { label: "Semua", value: "all" },
                { label: "Submitted", value: "submitted" },
                { label: "Approved", value: "approved" },
                { label: "Revision", value: "revision_requested" }
              ].map(tab => (
                <Link
                  key={tab.value}
                  href={`/dashboard/intern/daily-reports?status=${tab.value}`}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    currentFilter === tab.value
                      ? "bg-white text-teal-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-950"
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>

          {filteredReports.length === 0 ? (
            <div className="surface p-8 text-center text-slate-500">
              Tidak ada laporan dengan status ini.
            </div>
          ) : (
            <div className="grid gap-2">
              {filteredReports.map((report) => (
                <div key={report.id} className="surface p-3 bg-white hover:border-teal-500 transition-all flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-xs text-slate-400 font-bold block">{formatDate(report.report_date)}</span>
                    <p className="text-sm font-bold text-slate-800 truncate mt-0.5">{report.today_work}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ReportStatusBadge status={report.status} />
                    
                    {/* Tombol Detail */}
                    <Link
                      href={`/dashboard/intern/daily-reports?detailReportId=${report.id}&status=${currentFilter}`}
                      className="button-secondary p-1.5 min-h-0 text-slate-600 hover:bg-slate-100"
                      title="Lihat Detail Laporan"
                    >
                      <Eye size={15} />
                    </Link>

                    {/* Tombol Edit Revisi */}
                    {report.status === "revision_requested" && (
                      <Link
                        href={`/dashboard/intern/daily-reports?editReportId=${report.id}&status=${currentFilter}`}
                        className="button-secondary p-1.5 min-h-0 text-teal-600 hover:bg-teal-50 hover:text-teal-700 border-teal-200"
                        title="Edit Revisi Laporan"
                      >
                        <Edit3 size={15} />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* POPUP MODAL DETAIL LAPORAN */}
      {detailReport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-black text-slate-900">Detail Laporan Harian</h3>
                <p className="text-xs text-slate-400 font-semibold">{formatDate(detailReport.report_date)}</p>
              </div>
              <Link
                href={`/dashboard/intern/daily-reports?status=${currentFilter}`}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
              >
                <X size={18} />
              </Link>
            </div>

            {/* Isi Modal */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-slate-500 font-bold">Status:</span>
                <ReportStatusBadge status={detailReport.status} />
              </div>

              <div>
                <h4 className="text-sm font-black text-slate-950">Pekerjaan Hari Ini</h4>
                <p className="mt-1 text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                  {detailReport.today_work}
                </p>
              </div>

              {detailReport.progress ? (
                <div>
                  <h4 className="text-sm font-black text-slate-950">Progress</h4>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                    {detailReport.progress}
                  </p>
                </div>
              ) : null}

              {detailReport.blockers ? (
                <div>
                  <h4 className="text-sm font-black text-slate-950">Kendala</h4>
                  <p className="mt-1 text-sm text-red-700 leading-relaxed bg-red-50/50 p-3 rounded-lg border border-red-100 whitespace-pre-wrap">
                    {detailReport.blockers}
                  </p>
                </div>
              ) : null}

              {detailReport.tomorrow_plan ? (
                <div>
                  <h4 className="text-sm font-black text-slate-950">Rencana Besok</h4>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                    {detailReport.tomorrow_plan}
                  </p>
                </div>
              ) : null}

              {/* Tampilkan Lampiran Gambar / Berkas */}
              {detailReport.daily_report_attachments && detailReport.daily_report_attachments.length > 0 ? (
                <div className="border-t border-slate-200 pt-3">
                  <h4 className="text-sm font-black text-slate-950 mb-2">Lampiran File & Link</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {detailReport.daily_report_attachments.map((att) => {
                      const isImg = isImageAttachment(att);
                      const isDrive = att.file_path.includes("google.com") || att.file_path.includes("drive.google.com");
                      
                      return (
                        <div key={att.id} className="surface p-2 border border-slate-200 rounded-lg hover:border-teal-500 transition-all bg-white flex flex-col justify-between">
                          {isImg ? (
                            <div className="w-full">
                              <p className="text-[10px] text-slate-400 font-bold truncate mb-1" title={att.file_name}>
                                {att.file_name}
                              </p>
                              <ImagePreview src={att.file_path} alt={att.file_name} className="max-h-28 w-auto object-contain mx-auto" />
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 h-full justify-between py-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-lg">{isDrive ? "??" : "??"}</span>
                                <span className="text-xs font-bold text-slate-700 truncate block max-w-[180px]" title={att.file_name}>
                                  {att.file_name}
                                </span>
                              </div>
                              <a href={att.file_path} target="_blank" rel="noopener noreferrer" className="button-secondary text-[10px] py-1 px-2.5 min-h-0 text-teal-700 border-teal-200 hover:bg-teal-50 font-bold text-center block w-full">
                                {isDrive ? "Buka Google Drive" : "Unduh File"}
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer Modal */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
              <Link
                href={`/dashboard/intern/daily-reports?status=${currentFilter}`}
                className="button-secondary text-sm font-semibold"
              >
                Tutup
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
