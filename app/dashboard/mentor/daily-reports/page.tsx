import { ImagePreview } from "@/features/daily-reports/ImagePreview";
import { getMentorDailyReports, getMentorProfileId } from "@/features/daily-reports/queries";
import { ReportStatusBadge } from "@/features/daily-reports/ReportStatusBadge";
import { ReviewReportForm } from "@/features/daily-reports/ReviewReportForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { X, Eye, ClipboardCheck } from "lucide-react";

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
  searchParams: Promise<{ detailReportId?: string; status?: string }>;
};

export default async function MentorDailyReportsPage({ searchParams }: PageProps) {
  const { detailReportId, status: statusFilter } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

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
  if (error) {
    console.error("=== DEBUG MENTOR DAILY REPORT ERROR ===", error);
  }

  // Filter laporan berdasarkan status
  const currentFilter = statusFilter || "all";
  const filteredReports = currentFilter === "all"
    ? reports
    : reports.filter(r => r.status === currentFilter);

  const pendingCount = reports.filter((r) => r.status === "submitted").length;
  const detailReport = detailReportId ? reports.find(r => r.id === detailReportId) : undefined;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 relative">
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
            <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800 animate-pulse">
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

      {/* Tabs Filter minimalis */}
      <div className="mb-6 flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg text-xs self-start w-fit">
        {[
          { label: "Semua", value: "all" },
          { label: "Submitted (" + pendingCount + ")", value: "submitted" },
          { label: "Approved", value: "approved" },
          { label: "Revision", value: "revision_requested" }
        ].map(tab => (
          <Link
            key={tab.value}
            href={`/dashboard/mentor/daily-reports?status=${tab.value}`}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              currentFilter === tab.value
                ? "bg-white text-teal-700 shadow-sm"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {filteredReports.length === 0 && !error ? (
        <div className="surface p-8 text-center text-slate-600">
          Belum ada laporan bimbingan dengan status ini.
        </div>
      ) : null}

      {/* List Laporan Minimalis */}
      <div className="grid gap-2">
        {filteredReports.map((report) => {
          const internName = report.intern_profiles?.user_profiles?.full_name ?? "Peserta";
          return (
            <div key={report.id} className="surface p-3 bg-white hover:border-teal-500 transition-all flex items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="text-xs text-slate-400 font-bold block">{formatDate(report.report_date)}</span>
                <p className="text-sm font-bold text-slate-800 truncate mt-0.5">
                  <span className="text-teal-700 font-black">{internName}</span> - {report.today_work}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ReportStatusBadge status={report.status} />
                
                {/* Tombol Detail / Review */}
                <Link
                  href={`/dashboard/mentor/daily-reports?detailReportId=${report.id}&status=${currentFilter}`}
                  className="button-secondary p-1.5 min-h-0 text-slate-600 hover:bg-slate-100 flex items-center gap-1 font-bold text-xs"
                  title="Lihat Detail & Review"
                >
                  <Eye size={15} />
                  <span>Detail</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* POPUP MODAL DETAIL & REVIEW */}
      {detailReport ? (
        (() => {
          const internName = detailReport.intern_profiles?.user_profiles?.full_name ?? "Peserta";
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                {/* Header Modal */}
                <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Review Laporan Harian</h3>
                    <p className="text-xs text-slate-400 font-semibold">
                      Peserta: <strong className="text-teal-700">{internName}</strong> | {formatDate(detailReport.report_date)}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/mentor/daily-reports?status=${currentFilter}`}
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
                  >
                    <X size={18} />
                  </Link>
                </div>

                {/* Isi Modal */}
                <div className="p-6 overflow-y-auto space-y-4">
                  <div className="flex items-center gap-2">
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

                  {/* Lampiran Gambar / Berkas */}
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

                  {/* Form Catatan / Feedback Review */}
                  <div className="border-t border-slate-200 pt-3">
                    <h4 className="text-sm font-black text-slate-950 mb-1">Feedback Mentor</h4>
                    <ReviewReportForm currentStatus={detailReport.status} reportId={detailReport.id} />
                  </div>
                </div>

                {/* Footer Modal */}
                <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
                  <Link
                    href={`/dashboard/mentor/daily-reports?status=${currentFilter}`}
                    className="button-secondary text-sm font-semibold"
                  >
                    Tutup
                  </Link>
                </div>
              </div>
            </div>
          );
        })()
      ) : null}
    </main>
  );
}
