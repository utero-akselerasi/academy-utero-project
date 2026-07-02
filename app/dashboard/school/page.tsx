import { getSchoolProfile, getSchoolInterns, getSchoolInternsDailyReports, getSchoolInternsAttendances } from "@/features/school/queries";
import { ReportStatusBadge } from "@/features/daily-reports/ReportStatusBadge";
import { ImagePreview } from "@/features/daily-reports/ImagePreview";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, Clock, FileText, Search, Eye, X, BookOpen, MapPin, Award, BarChart2 } from "lucide-react";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

function formatTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { timeStyle: "short" }).format(new Date(value));
}

function isImageAttachment(att: { mime_type?: string | null; file_name: string }) {
  if (att.mime_type && att.mime_type.startsWith("image/")) {
    return true;
  }
  const ext = att.file_name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "");
}

type PageProps = {
  searchParams: Promise<{ tab?: string; status?: string; q?: string; detailReportId?: string; detailAssessmentId?: string }>;
};

export default async function SchoolDashboardPage({ searchParams }: PageProps) {
  const { tab: activeTab = "interns", status: statusFilter = "all", q: searchQuery = "", detailReportId, detailAssessmentId } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: schoolProfile, error: schoolErr } = await getSchoolProfile(user.id);

  if (schoolErr || !schoolProfile) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="surface p-8 text-center border border-red-200 bg-red-50/50 rounded-xl">
          <BookOpen className="mx-auto text-red-500 mb-3" size={40} />
          <h2 className="text-xl font-bold text-red-950">Akses Portal Sekolah Belum Aktif</h2>
          <p className="mt-2 text-sm text-red-700 max-w-md mx-auto leading-relaxed">
            Akun perwakilan sekolah Anda belum dihubungkan ke instansi sekolah/kampus di database, atau terjadi kesalahan jaringan. Silakan hubungi Super Admin untuk penugasan instansi.
          </p>
        </div>
      </main>
    );
  }

  // Load semua data sekolah
  const { data: interns } = await getSchoolInterns(schoolProfile.id);
  const { data: reports } = await getSchoolInternsDailyReports(schoolProfile.id);
  
  const { data: attendances } = await getSchoolInternsAttendances(schoolProfile.id);

  // Statistik Instansi
  const totalInterns = interns ? interns.length : 0;
  const activeInterns = interns ? interns.filter(i => i.status === "active").length : 0;
  const alumniInterns = interns ? interns.filter(i => i.status === "completed" || i.status === "inactive").length : 0;
  
  let avgAttendanceRate = 0;
  if (interns && interns.length > 0) {
    let totalPresent = 0;
    let totalLogs = 0;
    interns.forEach(i => {
      const internAtt = attendances ? attendances.filter(a => a.intern_id === i.id) : [];
      totalLogs += internAtt.length;
      totalPresent += internAtt.filter(a => a.attendance_type === "present" && a.status === "valid").length;
    });
    avgAttendanceRate = totalLogs > 0 ? Math.round((totalPresent / totalLogs) * 100) : 100;
  }


  // Filter interns berdasarkan pencarian nama
  const filteredInterns = interns.filter(i => 
    i.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter reports berdasarkan pencarian nama & status
  const filteredReports = reports.filter(r => {
    const matchName = r.intern_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchName && matchStatus;
  });

  // Filter attendances berdasarkan pencarian nama & status
  const filteredAttendances = attendances.filter(a => {
    const matchName = a.intern_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchName && matchStatus;
  });

  const detailReport = detailReportId ? reports.find(r => r.id === detailReportId) : undefined;
  
  // Cari assessment bimbingan jika ada
  const selectedAssessmentIntern = detailAssessmentId ? interns.find(i => i.assessment?.id === detailAssessmentId) : undefined;
  const selectedAssessment = selectedAssessmentIntern?.assessment;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 relative">
      {/* Header Profil Sekolah */}
      <section className="surface p-6 bg-white border border-slate-200 rounded-xl mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-teal-700">Perwakilan Instansi</p>
          <h1 className="text-3xl font-black text-slate-950 mt-1">{schoolProfile.name}</h1>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2 font-semibold">
            <MapPin size={13} className="text-slate-400" />
            <span>{schoolProfile.address || "Alamat belum diset"}, {schoolProfile.city}, {schoolProfile.province}</span>
          </div>
        </div>
        <div className="bg-teal-50 text-teal-800 border border-teal-200 rounded-lg px-3 py-1.5 text-xs font-bold shrink-0">
          Tipe Instansi: {schoolProfile.type || "Sekolah/Kampus"}
        </div>
      </section>

      {/* Rangkuman Statistik Instansi */}
      <section className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
          <span className="rounded-lg bg-teal-50 p-2 text-teal-700 inline-block">
            <Users size={18} />
          </span>
          <p className="text-xs text-slate-400 font-bold uppercase">Total Siswa Terdaftar</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{totalInterns}</span>
            <span className="text-xs text-slate-400 font-bold">siswa</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
          <span className="rounded-lg bg-sky-50 p-2 text-sky-700 inline-block">
            <Clock size={18} />
          </span>
          <p className="text-xs text-slate-400 font-bold uppercase">Aktif Magang</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{activeInterns}</span>
            <span className="text-xs text-slate-400 font-bold">aktif</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
          <span className="rounded-lg bg-indigo-50 p-2 text-indigo-700 inline-block">
            <Award size={18} />
          </span>
          <p className="text-xs text-slate-400 font-bold uppercase">Alumni / Selesai</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{alumniInterns}</span>
            <span className="text-xs text-slate-400 font-bold">alumni</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
          <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700 inline-block">
            <BarChart2 size={18} />
          </span>
          <p className="text-xs text-slate-400 font-bold uppercase">Rerata Kehadiran</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{avgAttendanceRate}%</span>
            <span className="text-xs text-slate-400 font-bold">rata-rata</span>
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-px mb-6">
        {[
          { label: "Peserta Magang", value: "interns", icon: Users, count: interns.length },
          { label: "Absensi Harian", value: "attendance", icon: Clock, count: attendances.length },
          { label: "Laporan Harian", value: "reports", icon: FileText, count: reports.length }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <Link
              key={tab.value}
              href={`/dashboard/school?tab=${tab.value}`}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-bold transition-all -mb-px ${
                isActive
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-slate-500 hover:text-slate-950"
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                isActive ? "bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-500"
              }`}>
                {tab.count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Filter & Bar Pencarian */}
      <div className="mb-6 flex flex-col md:flex-row gap-3 items-center justify-between">
        <form className="relative w-full max-w-md">
          <input type="hidden" name="tab" value={activeTab} />
          <input type="hidden" name="status" value={statusFilter} />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={15} className="text-slate-400" />
          </div>
          <input
            className="form-input !pl-10"
            name="q"
            defaultValue={searchQuery}
            placeholder="Cari nama peserta magang..."
          />
        </form>

        {/* Filter Status Khusus untuk Absensi & Laporan */}
        {activeTab !== "interns" && (
          <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg text-xs self-end">
            {[
              { label: "Semua", value: "all" },
              ...(activeTab === "attendance" 
                ? [
                    { label: "Hadir", value: "present" },
                    { label: "Sakit", value: "sick" },
                    { label: "Absen", value: "absent" }
                  ]
                : [
                    { label: "Submitted", value: "submitted" },
                    { label: "Approved", value: "approved" },
                    { label: "Revision", value: "revision_requested" }
                  ]
              )
            ].map(tab => (
              <Link
                key={tab.value}
                href={`/dashboard/school?tab=${activeTab}&q=${searchQuery}&status=${tab.value}`}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                  statusFilter === tab.value
                    ? "bg-white text-teal-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-950"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Konten Utama Berdasarkan Tab Aktif */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Tab 1: Peserta Magang */}
        {activeTab === "interns" && (
          <div>
            {filteredInterns.length === 0 ? (
              <div className="p-8 text-center text-slate-500">Tidak ada data peserta magang.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <th className="p-4">Nama Lengkap</th>
                      <th className="p-4">Jurusan</th>
                      <th className="p-4">WhatsApp / Telp</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Periode</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-center">Sertifikat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInterns.map(i => (
                      <tr key={i.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="p-4 font-bold text-slate-900">{i.full_name}</td>
                        <td className="p-4 text-slate-600">{i.major || "-"}</td>
                        <td className="p-4 text-slate-600">{i.phone || "-"}</td>
                        <td className="p-4 text-slate-600">{i.email || "-"}</td>
                        <td className="p-4 text-slate-500 text-xs">
                          {i.start_date ? formatDate(i.start_date) : "-"} s.d. {i.end_date ? formatDate(i.end_date) : "-"}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            i.status === "active" 
                              ? "bg-teal-50 border-teal-200 text-teal-800" 
                              : "bg-amber-50 border-amber-200 text-amber-800"
                          }`}>
                            {i.status}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex flex-col items-center gap-1 justify-center">
                            {i.certificate ? (
                              <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded uppercase">
                                No: {i.certificate.certificate_number}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Belum Terbit</span>
                            )}

                            {i.assessment && i.assessment.status === "finalized" ? (
                              <div className="flex items-center gap-1 mt-1">
                                <span className="text-[10px] font-bold bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">
                                  Nilai: {i.assessment.final_score}
                                </span>
                                <Link 
                                  href={`/dashboard/school?tab=interns&detailAssessmentId=${i.assessment.id}`}
                                  className="button-secondary text-[9px] py-0.5 px-2 min-h-0 font-bold hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 rounded"
                                >
                                  Detail Rapor
                                </Link>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Absensi Harian */}
        {activeTab === "attendance" && (
          <div>
            {filteredAttendances.length === 0 ? (
              <div className="p-8 text-center text-slate-500">Tidak ada riwayat absensi.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <th className="p-4">Tanggal</th>
                      <th className="p-4">Nama Peserta</th>
                      <th className="p-4">Check In</th>
                      <th className="p-4">Check Out</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendances.map(a => (
                      <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="p-4 text-slate-900 font-semibold">{formatDate(a.attendance_date)}</td>
                        <td className="p-4 font-bold text-teal-700">{a.intern_name}</td>
                        <td className="p-4 text-slate-600 font-mono text-xs">{formatTime(a.check_in_at)}</td>
                        <td className="p-4 text-slate-600 font-mono text-xs">{formatTime(a.check_out_at)}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            a.status === "present"
                              ? "bg-teal-50 border-teal-200 text-teal-800"
                              : a.status === "sick"
                              ? "bg-amber-50 border-amber-200 text-amber-800"
                              : "bg-red-50 border-red-200 text-red-800"
                          }`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-slate-500">{a.review_note || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Laporan Harian */}
        {activeTab === "reports" && (
          <div>
            {filteredReports.length === 0 ? (
              <div className="p-8 text-center text-slate-500">Tidak ada riwayat laporan harian.</div>
            ) : (
              <div className="grid gap-px bg-slate-200">
                {filteredReports.map(r => (
                  <div key={r.id} className="bg-white p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-all">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">{formatDate(r.report_date)}</span>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">
                        <span className="text-teal-700 font-black mr-1">{r.intern_name}</span> - {r.today_work}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ReportStatusBadge status={r.status} />
                      <Link
                        href={`/dashboard/school?tab=reports&q=${searchQuery}&status=${statusFilter}&detailReportId=${r.id}`}
                        className="button-secondary p-1.5 min-h-0 text-slate-600 hover:bg-slate-100 flex items-center gap-1 font-bold text-xs"
                      >
                        <Eye size={14} />
                        <span>Detail</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* POPUP DETAIL LAPORAN HARIAN (UNTUK SEKOLAH) */}
      {detailReport ? (
        (() => {
          const internName = detailReport.intern_name;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                {/* Header Modal */}
                <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Laporan Harian Siswa</h3>
                    <p className="text-xs text-slate-400 font-semibold">
                      Nama Siswa: <strong className="text-teal-700">{internName}</strong> | {formatDate(detailReport.report_date)}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/school?tab=reports&q=${searchQuery}&status=${statusFilter}`}
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
                </div>

                {/* Footer Modal */}
                <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
                  <Link
                    href={`/dashboard/school?tab=reports&q=${searchQuery}&status=${statusFilter}`}
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
      {/* POPUP DETAIL RAPOR & PENILAIAN SISWA */}
      {selectedAssessmentIntern && selectedAssessment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-black text-slate-900">Rapor Hasil Magang</h3>
                <p className="text-xs text-slate-400 font-semibold">{selectedAssessmentIntern.full_name} � {selectedAssessmentIntern.major}</p>
              </div>
              <Link
                href="/dashboard/school?tab=interns"
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
              >
                <X size={18} />
              </Link>
            </div>

            {/* Content Rapor */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Score Average Circle */}
              <div className="flex flex-col items-center justify-center text-center p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Rerata Nilai Akhir</span>
                <span className="text-4xl font-black text-teal-700 block mt-1.5">{selectedAssessment.final_score}</span>
                <span className="text-xs font-bold text-slate-500 mt-1 uppercase">STATUS: FINALIZED</span>
              </div>

              {/* Individual Criteria Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider text-slate-400">Rincian Kompetensi Nilai</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="p-3">Aspek Penilaian</th>
                        <th className="p-3 text-right">Skor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(selectedAssessment.score || {}).map(([key, val]) => (
                        <tr key={key} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-700 uppercase">{key}</td>
                          <td className="p-3 font-bold text-slate-900 text-right">{val as any}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Feedback */}
              {selectedAssessment.feedback && (
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider text-slate-400">Catatan Masukan Pembimbing</h4>
                  <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                    "{selectedAssessment.feedback}"
                  </p>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
              <Link
                href="/dashboard/school?tab=interns"
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
