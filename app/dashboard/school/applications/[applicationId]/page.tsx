import Link from "next/link";
import { notFound } from "next/navigation";
import { getOwnSchoolApplication, getOwnSchoolSelectionResults } from "@/features/school-applications/queries";
import { buildPublicTimeline, statusLabel } from "@/features/school-applications/status";

export const dynamic = "force-dynamic";

export default async function SchoolApplicationDetailPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  const { application } = await getOwnSchoolApplication(applicationId);
  if (!application) notFound();
  const selectionResults = await getOwnSchoolSelectionResults(applicationId);
  const timeline = buildPublicTimeline(application);
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link className="text-sm font-bold text-blue-700" href="/dashboard/school/applications">← Kembali ke daftar</Link>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-bold uppercase tracking-widest text-blue-700">Detail calon peserta</p><h1 className="mt-2 text-3xl font-black text-slate-950">{application.fullName}</h1><dl className="mt-6 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs font-bold uppercase text-slate-400">Email</dt><dd className="mt-1 text-slate-800">{application.email}</dd></div><div><dt className="text-xs font-bold uppercase text-slate-400">Telepon</dt><dd className="mt-1 text-slate-800">{application.phone ?? "-"}</dd></div><div><dt className="text-xs font-bold uppercase text-slate-400">NIS/NIM</dt><dd className="mt-1 text-slate-800">{application.studentNumber ?? "-"}</dd></div><div><dt className="text-xs font-bold uppercase text-slate-400">Jurusan</dt><dd className="mt-1 text-slate-800">{application.major ?? "-"}</dd></div><div className="sm:col-span-2"><dt className="text-xs font-bold uppercase text-slate-400">Periode yang diusulkan</dt><dd className="mt-1 text-slate-800">{application.proposedStartDate ?? "-"} s/d {application.proposedEndDate ?? "-"}</dd></div></dl></section>
        <aside className="space-y-6"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-black text-slate-900">Ringkasan seleksi</h2><p className="mt-4 text-sm text-slate-500">Status pendaftaran</p><p className="font-bold text-blue-700">{statusLabel(application.status)}</p><p className="mt-4 text-sm text-slate-500">Status seleksi</p><p className="font-bold text-amber-700">{statusLabel(application.selectionStatus)}</p><p className="mt-4 text-sm text-slate-500">Status onboarding</p><p className="font-bold text-emerald-700">{statusLabel(application.onboardingStatus)}</p>{selectionResults.length ? <div className="mt-5 border-t border-slate-200 pt-4"><p className="text-xs font-bold uppercase text-slate-500">Hasil keputusan</p>{selectionResults.map((result) => <div className="mt-3 text-sm" key={result.decisionId}><p className="font-bold text-slate-900">{statusLabel(result.result)} · Nilai: {result.finalScore ?? "-"}</p>{result.publicNote ? <p className="text-slate-600">{result.publicNote}</p> : null}</div>)}</div> : null}<p className="mt-5 text-xs leading-5 text-slate-500">Portal sekolah hanya menampilkan ringkasan hasil. Jawaban, kunci jawaban, dan catatan internal tim Utero Academy tidak tersedia.</p></section><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-black text-slate-900">Linimasa status</h2><ol className="mt-4 space-y-4">{timeline.map((item, index) => <li className="border-l-2 border-blue-200 pl-4" key={`${item.label}-${index}`}><p className="font-semibold text-slate-800">{item.label}</p><time className="text-xs text-slate-500">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.at))}</time></li>)}</ol></section></aside>
      </div>
    </main>
  );
}
