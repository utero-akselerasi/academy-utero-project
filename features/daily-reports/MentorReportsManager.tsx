"use client";

import { useState } from "react";
import { ReportStatusBadge } from "./ReportStatusBadge";
import { ReviewReportForm } from "./ReviewReportForm";
import { ImagePreview } from "./ImagePreview";
import { PDFPreview } from "./PDFPreview";
import { Users, FileText, Calendar, Filter, Eye, X, Printer, CheckCircle, HelpCircle } from "lucide-react";
import Link from "next/link";

type Attachment = {
  id: string;
  report_id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

type DailyReportWithIntern = {
  id: string;
  intern_id: string;
  report_date: string;
  today_work: string;
  progress: string | null;
  blockers: string | null;
  tomorrow_plan: string | null;
  status: "submitted" | "approved" | "revision_requested";
  created_at: string;
  updated_at: string;
  daily_report_attachments: Attachment[];
  intern_profiles: {
    id: string;
    user_id: string;
    user_profiles: {
      full_name: string;
    } | null;
  } | null;
};

type Props = {
  reports: DailyReportWithIntern[];
};

function isImageAttachment(att: Attachment) {
  if (att.mime_type && att.mime_type.startsWith("image/")) {
    return true;
  }
  const ext = att.file_name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

export function MentorReportsManager({ reports }: Props) {
  const [selectedInternId, setSelectedInternId] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<"all" | "weekly" | "monthly">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  // Group reports by intern
  const internsMap = new Map<string, {
    id: string;
    name: string;
    reportsCount: number;
    pendingCount: number;
    reports: DailyReportWithIntern[];
  }>();

  reports.forEach(r => {
    const name = r.intern_profiles?.user_profiles?.full_name || "Peserta Magang";
    const internId = r.intern_id;
    if (!internsMap.has(internId)) {
      internsMap.set(internId, {
        id: internId,
        name,
        reportsCount: 0,
        pendingCount: 0,
        reports: []
      });
    }
    const current = internsMap.get(internId)!;
    current.reportsCount++;
    if (r.status === "submitted") {
      current.pendingCount++;
    }
    current.reports.push(r);
  });

  const uniqueInterns = Array.from(internsMap.values());

  const selectedIntern = selectedInternId ? internsMap.get(selectedInternId) : null;

  // Filter reports of selected intern
  const filteredReports = selectedIntern
    ? selectedIntern.reports.filter(r => {
        // Status filter
        const matchStatus = statusFilter === "all" || r.status === statusFilter;
        
        // Time filter
        let matchTime = true;
        const reportDate = new Date(r.report_date);
        const today = new Date();
        
        if (timeFilter === "weekly") {
          // Last 7 days
          const diffTime = today.getTime() - reportDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          matchTime = diffDays <= 7;
        } else if (timeFilter === "monthly") {
          // Current month
          matchTime = reportDate.getMonth() === today.getMonth() && reportDate.getFullYear() === today.getFullYear();
        }
        
        return matchStatus && matchTime;
      })
    : [];

  const activeReport = activeReportId ? reports.find(r => r.id === activeReportId) : null;

  return (
    <div className="space-y-6">
      {/* Grid Profil Intern */}
      {uniqueInterns.length === 0 ? (
        <div className="surface p-8 text-center text-slate-500 font-medium">
          Belum ada anak magang bimbingan yang mengirimkan laporan harian.
        </div>
      ) : (
        <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {uniqueInterns.map((intern) => (
            <article 
              key={intern.id}
              onClick={() => {
                setSelectedInternId(intern.id);
                setTimeFilter("all");
                setStatusFilter("all");
              }}
              className="surface p-3 sm:p-5 bg-white border border-slate-200 rounded-2xl hover:border-teal-500 hover:shadow-md cursor-pointer transition-all duration-200 flex flex-col justify-between items-center text-center gap-2 sm:gap-3 relative group"
            >
              {intern.pendingCount > 0 && (
                <span className="absolute top-3 right-3 h-5 min-w-5 px-1.5 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                  {intern.pendingCount}
                </span>
              )}
              
              <div className="h-10 w-10 sm:h-16 sm:w-16 rounded-full bg-teal-50 text-teal-800 font-black text-sm sm:text-xl flex items-center justify-center border border-teal-150">
                {intern.name.charAt(0)}
              </div>

              <div>
                <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-teal-700 transition-colors line-clamp-2 break-words min-h-[2rem] flex items-center justify-center">
                  {intern.name}
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">ID: {intern.id.slice(0, 8)}</p>
              </div>

              <div className="w-full bg-slate-50 border border-slate-100 p-1.5 sm:p-2 rounded-xl text-center text-[10px] sm:text-xs font-bold text-slate-600 mt-1 sm:mt-2">
                <span>{intern.reportsCount} Laporan Harian</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* POPUP MODAL RIWAYAT LAPORAN PER INTERN */}
      {selectedIntern && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div>
                <span className="text-[9px] font-black uppercase text-teal-700">Laporan Bimbingan</span>
                <h3 className="text-base font-black text-slate-950 mt-0.5">{selectedIntern.name}</h3>
              </div>
              <button
                onClick={() => setSelectedInternId(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter and Print bar */}
            <div className="px-6 py-3 border-b border-slate-150 bg-slate-50/50 flex flex-col sm:flex-row gap-3 justify-between items-center">
              {/* Filter Waktu */}
              <div className="flex gap-1.5 bg-slate-200/60 p-1 rounded-lg text-xs font-bold text-slate-600 shrink-0">
                {[
                  { label: "Semua Laporan", value: "all" },
                  { label: "Minggu Ini", value: "weekly" },
                  { label: "Bulan Ini", value: "monthly" }
                ].map(filter => (
                  <button
                    key={filter.value}
                    onClick={() => setTimeFilter(filter.value as any)}
                    className={`px-3 py-1 rounded-md transition-all ${
                      timeFilter === filter.value 
                        ? "bg-white text-slate-950 shadow-sm" 
                        : "hover:text-slate-950"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Print PDF Button */}
                <Link
                  href={`/dashboard/mentor/daily-reports/print/${selectedIntern.id}?filter=${timeFilter}`}
                  target="_blank"
                  className="button-secondary text-xs h-8 py-0 px-3 flex items-center gap-1.5 font-bold bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 shrink-0 whitespace-nowrap"
                >
                  <Printer size={13} />
                  <span>Cetak PDF Rekap</span>
                </Link>

                {/* Filter Status */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-slate-200 rounded-lg text-xs px-2 bg-white h-8 w-32 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-slate-850 font-bold"
                >
                  <option value="all">Semua Status</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="revision_requested">Revision</option>
                </select>
              </div>
            </div>

            {/* List Laporan */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {filteredReports.length === 0 ? (
                <p className="text-sm text-slate-500 italic py-8 text-center">Tidak ada laporan bimbingan yang cocok dengan filter.</p>
              ) : (
                <div className="grid gap-4">
                  {filteredReports.map((report) => (
                    <article 
                      key={report.id} 
                      className="p-4 border border-slate-150 rounded-xl bg-slate-50/50 hover:bg-slate-50 hover:border-teal-300 transition-all cursor-pointer flex justify-between items-start gap-4"
                      onClick={() => setActiveReportId(report.id)}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-xs">{formatDate(report.report_date)}</span>
                          <ReportStatusBadge status={report.status} />
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mt-1">
                          {report.today_work}
                        </p>
                      </div>
                      <span className="button-secondary text-[10px] py-1 px-2 min-h-0 font-bold shrink-0 flex items-center gap-1">
                        <Eye size={10} />
                        <span>Detail & Review</span>
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedInternId(null)}
                className="button-secondary text-sm font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP DETAIL REPORT & FEEDBACK FORM */}
      {activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div>
                <span className="text-[9px] font-black uppercase text-teal-700">Review Laporan Harian</span>
                <h3 className="text-sm font-black text-slate-950 mt-0.5">{formatDate(activeReport.report_date)}</h3>
              </div>
              <button
                onClick={() => setActiveReportId(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold uppercase">Status Laporan:</span>
                <ReportStatusBadge status={activeReport.status} />
              </div>

              <div>
                <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider text-slate-400">Pekerjaan Hari Ini</h4>
                <p className="mt-1 text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                  {activeReport.today_work}
                </p>
              </div>

              {activeReport.progress ? (
                <div>
                  <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider text-slate-400">Kemajuan (Progress)</h4>
                  <p className="mt-1 text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                    {activeReport.progress}
                  </p>
                </div>
              ) : null}

              {activeReport.blockers ? (
                <div>
                  <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider text-red-500">Kendala</h4>
                  <p className="mt-1 text-xs text-red-750 leading-relaxed bg-red-50/50 p-3 rounded-lg border border-red-100 whitespace-pre-wrap">
                    {activeReport.blockers}
                  </p>
                </div>
              ) : null}

              {activeReport.tomorrow_plan ? (
                <div>
                  <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider text-slate-400">Rencana Besok</h4>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                    {activeReport.tomorrow_plan}
                  </p>
                </div>
              ) : null}

              {/* Lampiran */}
              {activeReport.daily_report_attachments && activeReport.daily_report_attachments.length > 0 && (
                <div className="border-t border-slate-150 pt-3">
                  <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider text-slate-400 mb-2">Lampiran File & Link</h4>
                  <div className="grid gap-2 grid-cols-2">
                    {activeReport.daily_report_attachments.map((att) => {
                      const isImg = isImageAttachment(att);
                      const isDrive = att.file_path.includes("google.com") || att.file_path.includes("drive.google.com");
                      
                      return (
                        <div key={att.id} className="p-2 border border-slate-200 rounded-lg bg-white flex flex-col justify-between text-xs">
                          {isImg ? (
                            <div>
                              <p className="text-[9px] text-slate-400 truncate mb-1" title={att.file_name}>{att.file_name}</p>
                              <ImagePreview src={att.file_path} alt={att.file_name} className="max-h-24 w-auto object-contain mx-auto" />
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 h-full justify-between py-1">
                              <span className="font-bold text-[10px] text-slate-700 truncate" title={att.file_name}>{att.file_name}</span>
                              <a href={att.file_path} target="_blank" rel="noopener noreferrer" className="button-secondary text-[9px] py-1 min-h-0 text-center block w-full">
                                {isDrive ? "Buka Drive" : "Unduh File"}
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Feedback Form */}
              <div className="border-t border-slate-150 pt-3">
                <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider text-slate-400 mb-2">Review & Catatan Revisi</h4>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <ReviewReportForm currentStatus={activeReport.status} reportId={activeReport.id} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveReportId(null)}
                className="button-secondary text-sm font-semibold"
              >
                Kembali
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
