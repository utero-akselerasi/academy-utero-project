import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { type InternshipApplication } from "@/features/admin/types";
import { applicationStatusLabel, formatApplicationTime } from "@/features/admin/application-display";
import { requireAdmin } from "@/features/auth/guards";
import { getLocalApplications } from "@/features/admin/local";

export default async function AdminApplicationsPage() {
  await requireAdmin();
  const { applications } = await getLocalApplications() as { applications: Array<InternshipApplication & { onboarding_status: string | null; converted_intern_id: string | null }> };

  return <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 sm:py-6">
    <header className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div><p className="text-xs font-bold uppercase tracking-wider text-teal-700">Seleksi administrasi</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Pendaftaran masuk</h1><p className="mt-1 text-sm text-slate-600">Pilih pelamar untuk membuka biodata, dokumen, dan tindakan review.</p></div>
      <span className="rounded-full bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-800">{applications.length} pelamar</span>
    </header>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Daftar pendaftaran">
      <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">Pelamar</th><th className="px-4 py-3">Kontak</th><th className="px-4 py-3">Sekolah / Jurusan</th><th className="px-4 py-3">Pendaftaran</th><th className="px-4 py-3">Seleksi</th><th className="px-4 py-3">Onboarding</th><th className="px-4 py-3 text-right">Biodata</th></tr></thead>
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
