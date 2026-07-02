import { ImagePreview } from "@/features/daily-reports/ImagePreview";
import { DailyReportForm } from "@/features/daily-reports/DailyReportForm";
import { getInternDailyReports, getInternProfileId } from "@/features/daily-reports/queries";
import { ReportStatusBadge } from "@/features/daily-reports/ReportStatusBadge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Eye, Edit3, X, PlusCircle, ArrowLeft } from "lucide-react";

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
  searchParams: Promise<{ editReportId?: string; detailReportId?: string; status?: string; showForm?: string }>;
};

export default async function InternDailyReportsPage({ searchParams }: PageProps) {
  const { editReportId, detailReportId, status: statusFilter, showForm } = await searchParams;
  
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
  const isFormOpen = showForm === "true" || !!editReportId;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 relative space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Peserta</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Daily Report</h1>
          <p className="mt-2 max-w-2xl leading-relaxed text-slate-600 text-sm">
            Catat pekerjaan harian Anda, bagikan progress, kendala, rencana kerja, beserta tautan/lampiran file pendukung.
          </p>
        </div>
        
        {/* Kirim Laporan Baru Button */}
        <Link
          href={`/dashboard/intern/daily-reports?showForm=true&status=${currentFilter}`}
          className="button-primary text-xs py-2 px-4 min-h-0 flex items-center gap-1.5 font-bold rounded-lg shrink-0 self-start md:self-center"
        >
          <PlusCircle size={15} />
          <span>Kirim Laporan Baru</span>
        </Link>
      </div>

      {error ? (
        <div className="surface p-4 text-sm font-semibold text-red-700 mb-6">
          Gagal memuat task. Cek koneksi database.
        </div>
      ) : null}

      {/* Filter and Content Table */}
      <div className="space-y-4">
        {/* Filter Status Tabs */}
        <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg text-xs w-fit">
          {[
            { label: "Semua Laporan", value: "all" },
            { label: "Submitted", value: "submitted" },
            { label: "Approved", value: "approved" },
            { label: "Revision", value: "revision_requested" }
          ].map(tab => (
            <Link
              key={tab.value}
              href={`/dashboard/intern/daily-reports?status=${tab.value}`}
              className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                currentFilter === tab.value
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Tabel Pengguna */}
        {filteredReports.length === 0 ? (
          <div className="surface p-8 text-center text-slate-500 font-medium">
            Tidak ada laporan bimbingan dengan status ini.
          </div>
        ) : (
          <div className="surface overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <th className="p-4">Tanggal Laporan</th>
                    <th className="p-4">Pekerjaan Hari Ini</th>
                    <th className="p-4">Kendala</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => (
                    <tr key={report.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-all">
                      <td className="p-4 font-bold text-slate-900 whitespace-nowrap">
                        {formatDate(report.report_date)}
                      </td>
                      <td className="p-4 text-slate-700 font-medium max-w-xs truncate" title={report.today_work}>
                        {report.today_work}
                      </td>
                      <td className="p-4 text-slate-500">
                        {report.blockers ? (
                          <span className="text-[9px] bg-red-50 border border-red-200 text-red-700 px-1.5 py-0.5 rounded font-extrabold uppercase">
                            Ada Kendala
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-semibold">Normal</span>
                        )}
                      </td>
                      <td className="p-4">
                        <ReportStatusBadge status={report.status} />
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/dashboard/intern/daily-reports?detailReportId=${report.id}&status=${currentFilter}`}
                            className="button-secondary p-1.5 min-h-0 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center"
                            title="Lihat Detail"
                          >
                            <Eye size={13} />
                          </Link>

                          {report.status === "revision_requested" && (
                            <Link
                              href={`/dashboard/intern/daily-reports?editReportId=${report.id}&status=${currentFilter}`}
                              className="button-secondary py-1 px-2.5 min-h-0 text-teal-750 hover:bg-teal-50 border border-teal-200 rounded-lg flex items-center gap-1 font-bold text-[10px]"
                              title="Edit / Revisi Laporan"
                            >
                              <Edit3 size={11} />
                              <span>Revisi</span>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* POPUP MODAL FORM INPUT / EDIT DAILY REPORT */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-black text-slate-950">
                {editReport ? "Edit / Revisi Laporan" : "Kirim Laporan Baru"}
              </h3>
              <Link
                href={`/dashboard/intern/daily-reports?status=${currentFilter}`}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
              >
                <X size={18} />
              </Link>
            </div>

            {/* Form */}
            <div className="p-6 overflow-y-auto max-h-[75vh]">
              <DailyReportForm editReport={editReport} />
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL DETAIL LAPORAN */}
      {detailReport && (
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
      )}
    </main>
  );
}
