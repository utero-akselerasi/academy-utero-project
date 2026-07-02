import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { getInternDailyReports } from "@/features/daily-reports/queries";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ internId: string }>;
  searchParams: Promise<{ filter?: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

export default async function PrintDailyReportPage({ params, searchParams }: Props) {
  const { internId } = await params;
  const { filter = "all" } = await searchParams;

  const db = await createUteroAcademyServiceRoleClient();

  // 1. Fetch intern profile
  const { data: intern } = await db
    .from("intern_profiles")
    .select("*, schools(name)")
    .eq("id", internId)
    .maybeSingle();

  if (!intern) {
    return (
      <div className="p-8 text-center text-red-650 font-bold">
        Data peserta magang tidak ditemukan.
      </div>
    );
  }

  const schoolObj = Array.isArray(intern.schools) ? intern.schools[0] : intern.schools;
  const schoolName = schoolObj?.name || "-";

  // 2. Fetch reports
  const { data: reports } = await getInternDailyReports(internId);

  // 3. Filter reports by time
  const filteredReports = reports.filter(r => {
    let matchTime = true;
    const reportDate = new Date(r.report_date);
    const today = new Date();
    
    if (filter === "weekly") {
      const diffTime = today.getTime() - reportDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      matchTime = diffDays <= 7;
    } else if (filter === "monthly") {
      matchTime = reportDate.getMonth() === today.getMonth() && reportDate.getFullYear() === today.getFullYear();
    }
    
    return matchTime;
  });

  const totalReports = filteredReports.length;
  const approvedReports = filteredReports.filter(r => r.status === "approved").length;
  const revisionReports = filteredReports.filter(r => r.status === "revision_requested").length;

  return (
    <div className="bg-white min-h-screen text-slate-900 p-8 font-sans max-w-4xl mx-auto A4-print">
      {/* Autoprint script */}
      <script dangerouslySetInnerHTML={{ __html: `window.onload = function() { window.print(); }` }} />

      {/* CSS Styling for Print and A4 page setup */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background: white;
            color: black;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 1.5cm;
          }
        }
        .A4-print {
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        @media print {
          .A4-print {
            border: none;
            box-shadow: none;
            padding: 0;
          }
        }
      ` }} />

      {/* Header Kop Laporan */}
      <header className="border-b-4 border-double border-slate-950 pb-4 text-center space-y-1">
        <h1 className="text-xl font-black uppercase tracking-wider text-slate-950">UTERO ACADEMY MALANG</h1>
        <p className="text-xs font-semibold text-slate-500">Kawasan Industri Kreatif, Jl. Sulfat Agung No.51, Malang, Jawa Timur</p>
        <p className="text-[10px] text-slate-400 font-mono">Email: info@utero.id | Telp: (0341) 408408</p>
      </header>

      {/* Title */}
      <div className="text-center my-6 space-y-1">
        <h2 className="text-base font-black uppercase text-slate-900 tracking-wider">REKAPITULASI LAPORAN KINERJA HARIAN (DAILY REPORTS)</h2>
        <p className="text-xs font-bold text-slate-500 uppercase">
          Periode: {filter === "all" ? "Semua Laporan" : filter === "weekly" ? "Minggu Ini" : "Bulan Ini"}
        </p>
      </div>

      {/* Metadata Intern */}
      <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs mb-6">
        <div>
          <span className="font-bold text-slate-400 block uppercase text-[9px]">Nama Lengkap</span>
          <span className="font-black text-slate-800 text-sm">{intern.full_name}</span>
        </div>
        <div>
          <span className="font-bold text-slate-400 block uppercase text-[9px]">Asal Sekolah / Kampus</span>
          <span className="font-bold text-slate-800">{schoolName}</span>
        </div>
        <div className="mt-1">
          <span className="font-bold text-slate-400 block uppercase text-[9px]">Jurusan / Major</span>
          <span className="font-bold text-slate-800">{intern.major || "-"}</span>
        </div>
        <div className="mt-1">
          <span className="font-bold text-slate-400 block uppercase text-[9px]">Tanggal Dicetak</span>
          <span className="font-bold text-slate-800">{formatDate(new Date().toISOString())}</span>
        </div>
      </section>

      {/* Stats Summary Panel */}
      <section className="grid grid-cols-3 gap-3 text-center text-xs mb-8">
        <div className="p-3 border border-slate-200 rounded-lg">
          <span className="font-bold text-slate-400 block uppercase text-[8px]">Total Laporan</span>
          <span className="text-base font-black text-slate-850 mt-1 block">{totalReports}</span>
        </div>
        <div className="p-3 border border-slate-200 rounded-lg bg-teal-50/50">
          <span className="font-bold text-teal-800 block uppercase text-[8px]">Disetujui</span>
          <span className="text-base font-black text-teal-800 mt-1 block">{approvedReports}</span>
        </div>
        <div className="p-3 border border-slate-200 rounded-lg bg-red-50/55">
          <span className="font-bold text-red-700 block uppercase text-[8px]">Revisi</span>
          <span className="text-base font-black text-red-700 mt-1 block">{revisionReports}</span>
        </div>
      </section>

      {/* Table of Reports */}
      <section className="mb-12">
        <table className="w-full text-left text-xs border-collapse border border-slate-250">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-250 text-slate-700 font-bold uppercase text-[9px]">
              <th className="p-3 border border-slate-250 w-28">Tanggal</th>
              <th className="p-3 border border-slate-250">Pekerjaan Hari Ini</th>
              <th className="p-3 border border-slate-250">Progress</th>
              <th className="p-3 border border-slate-250 w-24">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500 italic">
                  Tidak ditemukan laporan harian untuk periode ini.
                </td>
              </tr>
            ) : (
              filteredReports.map((report) => (
                <tr key={report.id} className="border-b border-slate-200 hover:bg-slate-50/30">
                  <td className="p-3 border border-slate-250 font-bold text-slate-800 leading-normal">
                    {formatDate(report.report_date)}
                  </td>
                  <td className="p-3 border border-slate-250 leading-relaxed whitespace-pre-wrap">
                    {report.today_work}
                    {report.blockers && (
                      <div className="text-[10px] text-red-650 font-semibold mt-1 bg-red-50 p-1.5 rounded border border-red-100">
                        Kendala: {report.blockers}
                      </div>
                    )}
                  </td>
                  <td className="p-3 border border-slate-250 leading-relaxed whitespace-pre-wrap text-slate-600">
                    {report.progress || "-"}
                  </td>
                  <td className="p-3 border border-slate-250 font-black uppercase text-[9px]">
                    <span className={
                      report.status === "approved" 
                        ? "text-teal-800" 
                        : report.status === "revision_requested" 
                        ? "text-red-750" 
                        : "text-amber-800"
                    }>
                      {report.status === "approved" ? "APPROVED" : report.status === "revision_requested" ? "REVISI" : "SUBMITTED"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Signature Area */}
      <footer className="grid grid-cols-2 gap-12 text-center text-xs mt-16 pt-8 border-t border-slate-100">
        <div className="space-y-16">
          <p className="font-semibold text-slate-500">Peserta Magang,</p>
          <div className="space-y-0.5">
            <p className="font-black text-slate-900 underline">{intern.full_name}</p>
            <p className="text-[10px] text-slate-400 font-mono">ID: {intern.id.slice(0, 8)}</p>
          </div>
        </div>
        <div className="space-y-16">
          <p className="font-semibold text-slate-500">Pembimbing Utero Academy,</p>
          <div className="space-y-0.5">
            <p className="font-black text-slate-900 underline">Fitri Labuda</p>
            <p className="text-[10px] text-slate-400 uppercase">Head of Utero Academy</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
