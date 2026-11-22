import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationStatusForm } from "@/features/admin/ApplicationStatusForm";
import { type InternshipApplication } from "@/features/admin/types";
import { applicationStatusLabel, formatApplicationDate, formatApplicationTime } from "@/features/admin/application-display";
import { requireAdmin } from "@/features/auth/guards";
import { resolveStorageUrl } from "@/lib/storage-urls";
import { getLocalApplications } from "@/features/admin/local";

type ApplicationDetail = InternshipApplication & { onboarding_status: string | null; converted_intern_id: string | null; approved_start_date?: string | null; approved_end_date?: string | null; cv_path?: string | null; portfolio_path?: string | null };

export default async function AdminApplicationDetailPage({ params }: { params: Promise<{ applicationId: string }> }) {
  await requireAdmin();
  const { applicationId } = await params;
  const result = await getLocalApplications() as { applications: ApplicationDetail[] };
  const application = result.applications.find((item) => item.id === applicationId);
  if (!application) notFound();
  const [cvUrl, portfolioUrl] = await Promise.all([
    resolveStorageUrl("academy-private", application.cv_path),
    resolveStorageUrl("academy-private", application.portfolio_path),
  ]);

  return <main className="mx-auto max-w-6xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
    <Link href="/dashboard/admin/pendaftaran" className="text-sm font-semibold text-teal-800 hover:underline">Kembali ke daftar pendaftaran</Link>
    <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-teal-700">Biodata pelamar</p><h1 className="mt-1 text-2xl font-bold text-slate-950">{application.full_name}</h1><p className="mt-1 text-sm text-slate-600">{application.email} · {application.phone ?? "WhatsApp belum diisi"}</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">{applicationStatusLabel(application.status)}</span></div>
    </header>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="font-bold text-slate-950">Informasi pelamar</h2><dl className="mt-3 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Email</dt><dd className="mt-1 break-all text-sm font-medium text-slate-900">{application.email}</dd></div><div><dt className="text-xs text-slate-500">WhatsApp</dt><dd className="mt-1 text-sm font-medium text-slate-900">{application.phone ?? "-"}</dd></div><div><dt className="text-xs text-slate-500">Sekolah / kampus</dt><dd className="mt-1 text-sm font-medium text-slate-900">{application.school_name ?? "-"}</dd></div><div><dt className="text-xs text-slate-500">Jurusan</dt><dd className="mt-1 text-sm font-medium text-slate-900">{application.major ?? "-"}</dd></div></dl></section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="font-bold text-slate-950">Periode magang</h2><dl className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Usulan</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{formatApplicationDate(application.proposed_start_date)} – {formatApplicationDate(application.proposed_end_date)}</dd></div>{application.approved_start_date || application.approved_end_date ? <div className="rounded-lg bg-teal-50 p-3"><dt className="text-xs text-teal-700">Disetujui</dt><dd className="mt-1 text-sm font-semibold text-teal-950">{formatApplicationDate(application.approved_start_date)} – {formatApplicationDate(application.approved_end_date)}</dd></div> : null}</dl></section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="font-bold text-slate-950">Dokumen dan motivasi</h2><div className="mt-3 flex flex-wrap gap-2">{cvUrl ? <a href={cvUrl} target="_blank" rel="noopener noreferrer" className="button-secondary">Lihat / unduh CV</a> : <span className="text-sm text-slate-500">CV tidak tersedia</span>}{portfolioUrl ? <a href={portfolioUrl} target="_blank" rel="noopener noreferrer" className="button-secondary">Lihat portofolio</a> : null}</div><h3 className="mt-5 text-sm font-semibold text-slate-800">Motivasi</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{application.motivation || "Tidak ada motivasi yang dicantumkan."}</p><p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">Didaftarkan {formatApplicationTime(application.created_at)}</p></section>
      </div>
      <aside className="h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="font-bold text-slate-950">Tindakan review</h2><p className="mt-1 text-xs leading-5 text-slate-600">Tinjau dokumen dan hasil seleksi sebelum memperbarui status pendaftaran.</p><div className="mt-4"><ApplicationStatusForm id={application.id} status={application.status} selectionStatus={application.selection_status ?? null} onboardingStatus={application.onboarding_status} convertedInternId={application.converted_intern_id} /></div></aside>
    </div>
  </main>;
}
