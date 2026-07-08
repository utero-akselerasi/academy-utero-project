import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSchoolProfile, getSchoolReports } from "@/features/school/queries";

export default async function SchoolReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { from, to } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: schoolProfile } = await getSchoolProfile(user.id);
  if (!schoolProfile) redirect("/dashboard/school");

  const { data: reports } = await getSchoolReports(schoolProfile.id);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">School Portal</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Laporan Periodik</h1>
          <p className="mt-1 text-sm text-slate-600">Generate dan unduh laporan siswa magang per periode.</p>
        </div>
        <Link className="button-secondary" href="/dashboard/school">Kembali ke Dashboard</Link>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Generate Laporan Baru</h2>
        <form action="/dashboard/school/reports/generate" method="get" className="mt-4 grid gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">Dari Tanggal</label>
            <input type="date" name="from" required defaultValue={from} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">Sampai Tanggal</label>
            <input type="date" name="to" required defaultValue={to} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800">Generate</button>
          </div>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">Riwayat Laporan</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase text-slate-500">
                <th className="px-6 py-3">Periode</th>
                <th className="px-6 py-3">Total Siswa</th>
                <th className="px-6 py-3">Dibuat</th>
                <th className="px-6 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(reports || []).map((report: any) => (
                <tr key={report.id}>
                  <td className="px-6 py-4 text-slate-900">
                    {report.period_start} s/d {report.period_end}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{report.total_students}</td>
                  <td className="px-6 py-4 text-slate-500">{new Date(report.created_at).toLocaleDateString("id-ID")}</td>
                  <td className="px-6 py-4">
                    {report.file_path && (
                      <a href={report.file_path} className="text-sm font-bold text-teal-700 hover:text-teal-800" target="_blank" rel="noopener">Download CSV</a>
                    )}
                  </td>
                </tr>
              ))}
              {(!reports || reports.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Belum ada laporan.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
