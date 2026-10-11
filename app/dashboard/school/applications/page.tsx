import Link from "next/link";
import { APPLICATION_STATUSES, SELECTION_STATUSES, type ApplicationStatus, type SelectionStatus } from "@/features/school-applications/types";
import { getOwnSchoolApplications } from "@/features/school-applications/queries";
import { retryApplicantInvitationAction } from "@/features/school-applications/actions";
import { statusLabel } from "@/features/school-applications/status";

export const dynamic = "force-dynamic";

export default async function SchoolApplicationsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: ApplicationStatus; selection?: SelectionStatus; invite?: string }> }) {
  const params = await searchParams;
  const { school, applications } = await getOwnSchoolApplications({ query: params.q, status: params.status ?? "all", selectionStatus: params.selection ?? "all" });
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <section className="rounded-3xl bg-gradient-to-r from-blue-800 via-blue-700 to-cyan-700 p-7 text-white shadow-lg">
        <p className="text-sm font-bold uppercase tracking-widest text-blue-100">Pendaftaran Partner</p>
        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><h1 className="text-3xl font-black">Calon peserta {school.name}</h1><p className="mt-2 text-blue-50">Daftarkan siswa dan pantau proses seleksi hingga onboarding.</p></div><Link className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-800" href="/dashboard/school/applications/new">+ Daftarkan peserta</Link></div>
      </section>
      {params.invite === "sent" ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Undangan akun berhasil dikirim dan ditautkan.</p> : null}
      {params.invite === "linked" ? <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800">Akun yang sudah ada berhasil ditautkan. Tidak ada undangan duplikat.</p> : null}
      {params.invite === "failed" ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">Undangan belum berhasil diproses. Periksa email atau coba lagi.</p> : null}
      {params.invite === "role-conflict" ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">Email sudah memakai akun intern, sekolah, atau staf. Gunakan email lain agar akses internal tidak tercampur dengan portal applicant.</p> : null}
      <form className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_220px_220px_auto]">
        <input className="rounded-xl border border-slate-300 px-3 py-2 text-sm" defaultValue={params.q} name="q" placeholder="Cari nama, email, NIS/NIM" />
        <select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" defaultValue={params.status ?? "all"} name="status"><option value="all">Semua status</option>{APPLICATION_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select>
        <select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" defaultValue={params.selection ?? "all"} name="selection"><option value="all">Semua seleksi</option>{SELECTION_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select>
        <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">Filter</button>
      </form>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-4">Peserta</th><th className="p-4">Jurusan</th><th className="p-4">Periode usulan</th><th className="p-4">Pendaftaran</th><th className="p-4">Seleksi</th><th className="p-4" /></tr></thead><tbody className="divide-y divide-slate-100">{applications.map((application) => <tr key={application.id}><td className="p-4"><strong className="text-slate-900">{application.fullName}</strong><br /><span className="text-xs text-slate-500">{application.email} · {application.studentNumber}</span></td><td className="p-4 text-slate-600">{application.major ?? "-"}</td><td className="p-4 text-slate-600">{application.proposedStartDate ?? "-"} s/d {application.proposedEndDate ?? "-"}</td><td className="p-4"><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{statusLabel(application.status)}</span></td><td className="p-4"><span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">{statusLabel(application.selectionStatus)}</span></td><td className="p-4 text-right"><div className="flex items-center justify-end gap-3">{application.applicantUserId ? null : <form action={retryApplicantInvitationAction}><input name="applicationId" type="hidden" value={application.id} /><button className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900" type="submit">Kirim ulang undangan</button></form>}<Link className="font-bold text-blue-700" href={`/dashboard/school/applications/${application.id}`}>Detail</Link></div></td></tr>)}{applications.length === 0 ? <tr><td className="p-8 text-center text-slate-500" colSpan={6}>Belum ada pendaftaran sesuai filter.</td></tr> : null}</tbody></table></div>
    </main>
  );
}
