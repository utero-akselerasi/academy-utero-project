import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { type InternshipApplication } from "@/features/admin/types";
import { applicationStatusLabel, formatApplicationTime } from "@/features/admin/application-display";
import { requireAdmin } from "@/features/auth/guards";
import { getLocalApplications } from "@/features/admin/local";

export default async function AdminApplicationsPage() {
  await requireAdmin();
  const { applications } = await getLocalApplications() as { applications: Array<InternshipApplication & { onboarding_status: string | null; converted_intern_id: string | null }> };
  const pendingReview = applications.filter((item) => item.status === "submitted").length;
  const passedSelection = applications.filter((item) => item.selection_status === "passed").length;

  return <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 sm:py-6">
    <header className="rounded-2xl bg-slate-950 p-5 text-white shadow-lg sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-300">Seleksi administrasi / antrean</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Pendaftaran masuk</h1><p className="mt-1 text-sm text-slate-300">Pantau progres pelamar dan buka biodata untuk meninjau dokumen atau mengambil tindakan.</p></div><Link href="/dashboard/admin/selection#penugasan" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/30 px-3 text-sm font-semibold hover:bg-white/10">Kelola tugas seleksi <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
    </header>
    <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Ringkasan pendaftaran">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><p className="text-xl font-bold tabular-nums text-slate-950">{applications.length}</p><p className="text-xs text-slate-600">Total pelamar</p></div>
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><p className="text-xl font-bold tabular-nums text-slate-950">{pendingReview}</p><p className="text-xs text-slate-600">Perlu ditinjau</p></div>
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><p className="text-xl font-bold tabular-nums text-slate-950">{passedSelection}</p><p className="text-xs text-slate-600">Lolos seleksi</p></div>
    </div>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Daftar pendaftaran">
      <div className="border-b border-slate-200 px-4 py-3"><h2 className="font-bold text-slate-950">Daftar pelamar</h2><p className="text-xs text-slate-600">Setiap kolom menunjukkan tahap berbeda: administrasi, tes seleksi, dan onboarding.</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">Pelamar</th><th className="px-4 py-3">Kontak</th><th className="px-4 py-3">Sekolah / Jurusan</th><th className="px-4 py-3">Administrasi</th><th className="px-4 py-3">Tes seleksi</th><th className="px-4 py-3">Onboarding</th><th className="px-4 py-3 text-right">Detail</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {applications.map((item) => <tr key={item.id} className="hover:bg-slate-50/70">
            <td className="px-4 py-3"><span className="block font-semibold text-slate-950">{item.full_name}</span><span className="text-xs text-slate-500">{item.major ?? "Jurusan belum diisi"}</span></td>
            <td className="px-4 py-3"><span className="block text-slate-800">{item.email}</span><span className="text-xs text-slate-500">{item.phone ?? "WhatsApp belum diisi"}</span></td>
            <td className="px-4 py-3 text-slate-700">{item.school_name ?? "-"}</td>
            <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{applicationStatusLabel(item.status)}</span><span className="mt-1 block text-xs text-slate-500">{formatApplicationTime(item.created_at)}</span></td>
            <td className="px-4 py-3 text-slate-700">{applicationStatusLabel(item.selection_status)}</td><td className="px-4 py-3 text-slate-700">{applicationStatusLabel(item.onboarding_status)}</td>
            <td className="px-4 py-3 text-right"><Link className="button-secondary inline-flex min-h-9 items-center gap-1.5 px-3 text-xs" href={`/dashboard/admin/pendaftaran/${item.id}`}>Buka biodata <ArrowUpRight size={14} aria-hidden="true" /></Link></td>
          </tr>)}
          {!applications.length ? <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Belum ada pendaftaran masuk.</td></tr> : null}
        </tbody>
      </table></div>
    </section>
  </main>;
}
