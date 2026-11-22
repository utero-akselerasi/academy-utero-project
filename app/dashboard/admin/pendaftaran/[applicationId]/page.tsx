import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ApplicationStatusForm } from "@/features/admin/ApplicationStatusForm";
import { type InternshipApplication } from "@/features/admin/types";
import { applicationStatusLabel, formatApplicationDate, formatApplicationTime } from "@/features/admin/application-display";
import { requireAdmin } from "@/features/auth/guards";
import { resolveStorageUrl } from "@/lib/storage-urls";
import { getLocalApplicationSelection, getLocalApplications } from "@/features/admin/local";

type ApplicationDetail = InternshipApplication & { onboarding_status: string | null; converted_intern_id: string | null; approved_start_date?: string | null; approved_end_date?: string | null; cv_path?: string | null; portfolio_path?: string | null; school_letter_path?: string | null; proposal_path?: string | null; avatar_path?: string | null };

export default async function AdminApplicationDetailPage({ params }: { params: Promise<{ applicationId: string }> }) {
  await requireAdmin();
  const { applicationId } = await params;
  const result = await getLocalApplications() as { applications: ApplicationDetail[] };
  const application = result.applications.find((item) => item.id === applicationId);
  if (!application) notFound();
  const [cvUrl, portfolioUrl, schoolLetterUrl, proposalUrl, avatarUrl, selectionData] = await Promise.all([
    resolveStorageUrl("academy-private", application.cv_path),
    resolveStorageUrl("academy-private", application.portfolio_path),
    resolveStorageUrl("academy-private", application.school_letter_path),
    resolveStorageUrl("academy-private", application.proposal_path),
    resolveStorageUrl("academy-private", application.avatar_path),
    getLocalApplicationSelection(application.id).catch(() => null),
  ]);
  const assignments = selectionData?.assignments ?? [];
  const nextStep = application.converted_intern_id ? "Profil peserta sudah dibuat" : application.status === "rejected" || application.status === "cancelled" ? "Pendaftaran tidak dilanjutkan" : application.selection_status === "passed" ? "Menunggu keputusan penerimaan" : application.selection_status === "failed" ? "Seleksi belum lolos" : "Menunggu tahapan sebelumnya";

  return <main className="mx-auto max-w-[1500px] space-y-4 px-4 py-5 sm:px-6 sm:py-6">
    <Link href="/dashboard/admin/pendaftaran" className="text-sm font-semibold text-teal-800 hover:underline">Kembali ke daftar pendaftaran</Link>
    <header className="grid gap-4 rounded-2xl bg-slate-950 p-5 text-white shadow-lg sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-stretch sm:p-6">
      <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.16em] text-red-300">Biodata / detail pelamar</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">{application.full_name}</h1><p className="mt-1 break-all text-sm text-slate-300">{application.email} · {application.phone ?? "WhatsApp belum diisi"}</p><span className="mt-4 inline-flex rounded-full border border-white/25 px-3 py-1 text-xs font-semibold">Administrasi: {applicationStatusLabel(application.status)}</span></div>
      <div className="flex min-h-36 flex-col items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-white/10 p-3 text-center" aria-label="Foto profil pelamar">{avatarUrl ? <Image src={avatarUrl} alt={`Foto profil ${application.full_name}`} width={96} height={96} unoptimized className="h-24 w-24 rounded-full object-cover ring-2 ring-white/50" /> : <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-700 text-3xl font-bold text-white" aria-hidden="true">{application.full_name.charAt(0).toUpperCase()}</div>}<span className="mt-2 text-xs text-slate-300">{avatarUrl ? "Foto profil" : "Foto belum diunggah"}</span></div>
    </header>
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Progres pendaftaran">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold text-slate-950">Progres pendaftaran</h2><p className="text-xs text-slate-600">Status tiap tahap berdasarkan data terbaru yang tersedia.</p></div><Link href="/dashboard/mentor/selection#review" className="text-sm font-semibold text-red-700 hover:underline">Buka ruang seleksi</Link></div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-3">
        <li className="rounded-lg border border-slate-200 bg-slate-50 p-3"><span className="text-xs font-bold uppercase text-slate-500">01 · Administrasi</span><p className="mt-1 text-sm font-semibold text-slate-900">{applicationStatusLabel(application.status)}</p><p className="mt-1 text-xs text-slate-600">Dikirim {formatApplicationTime(application.created_at)}</p></li>
        <li className="rounded-lg border border-slate-200 bg-slate-50 p-3"><span className="text-xs font-bold uppercase text-slate-500">02 · Seleksi</span><p className="mt-1 text-sm font-semibold text-slate-900">{applicationStatusLabel(application.selection_status)}</p><p className="mt-1 text-xs text-slate-600">{selectionData ? assignments.length + " tes pernah ditugaskan" : "Rincian tugas belum dapat dimuat"}</p></li>
        <li className="rounded-lg border border-slate-200 bg-slate-50 p-3"><span className="text-xs font-bold uppercase text-slate-500">03 · Onboarding</span><p className="mt-1 text-sm font-semibold text-slate-900">{applicationStatusLabel(application.onboarding_status)}</p><p className="mt-1 text-xs text-slate-600">{nextStep}</p></li>
      </ol>
      <div className="mt-4 border-t border-slate-200 pt-3"><h3 className="text-sm font-semibold text-slate-950">Riwayat tugas tes</h3>{selectionData ? assignments.length ? <ul className="mt-2 grid gap-2 sm:grid-cols-2">{assignments.map((assignment) => <li key={assignment.id} className="rounded-lg border border-slate-200 p-3 text-sm"><p className="font-semibold text-slate-900">{assignment.title}</p><p className="mt-1 text-xs text-slate-600">Penugasan: {applicationStatusLabel(assignment.status)} · Pengerjaan: {assignment.attempt_status ? applicationStatusLabel(assignment.attempt_status) : "Belum dimulai"}</p><p className="mt-1 text-xs text-slate-500">Ditugaskan {formatApplicationTime(assignment.assigned_at)}{assignment.started_at ? " · Mulai " + formatApplicationTime(assignment.started_at) : ""}{assignment.submitted_at ? " · Selesai " + formatApplicationTime(assignment.submitted_at) : ""}</p></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Belum ada tes yang ditugaskan untuk pendaftaran ini.</p> : <p className="mt-2 text-sm text-amber-800" role="status">Data tugas tes belum tersedia. Coba muat ulang sebelum mengambil keputusan.</p>}</div>
    </section>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="font-bold text-slate-950">Informasi pelamar</h2><dl className="mt-3 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Email</dt><dd className="mt-1 break-all text-sm font-medium text-slate-900">{application.email}</dd></div><div><dt className="text-xs text-slate-500">WhatsApp</dt><dd className="mt-1 text-sm font-medium text-slate-900">{application.phone ?? "-"}</dd></div><div><dt className="text-xs text-slate-500">Sekolah / kampus</dt><dd className="mt-1 text-sm font-medium text-slate-900">{application.school_name ?? "-"}</dd></div><div><dt className="text-xs text-slate-500">Jurusan</dt><dd className="mt-1 text-sm font-medium text-slate-900">{application.major ?? "-"}</dd></div></dl></section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="font-bold text-slate-950">Periode magang</h2><dl className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Usulan</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{formatApplicationDate(application.proposed_start_date)} – {formatApplicationDate(application.proposed_end_date)}</dd></div>{application.approved_start_date || application.approved_end_date ? <div className="rounded-lg bg-teal-50 p-3"><dt className="text-xs text-teal-700">Disetujui</dt><dd className="mt-1 text-sm font-semibold text-teal-950">{formatApplicationDate(application.approved_start_date)} – {formatApplicationDate(application.approved_end_date)}</dd></div> : null}</dl></section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="font-bold text-slate-950">Dokumen dan motivasi</h2><div className="mt-3 flex flex-wrap gap-2">{cvUrl ? <a href={cvUrl} target="_blank" rel="noopener noreferrer" className="button-secondary">Lihat / unduh CV</a> : <span className="text-sm text-slate-500">CV tidak tersedia</span>}{schoolLetterUrl ? <a href={schoolLetterUrl} target="_blank" rel="noopener noreferrer" className="button-secondary">Surat pengantar</a> : null}{proposalUrl ? <a href={proposalUrl} target="_blank" rel="noopener noreferrer" className="button-secondary">Proposal magang</a> : null}{portfolioUrl ? <a href={portfolioUrl} target="_blank" rel="noopener noreferrer" className="button-secondary">Lihat portofolio</a> : null}</div><h3 className="mt-5 text-sm font-semibold text-slate-800">Motivasi</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{application.motivation || "Tidak ada motivasi yang dicantumkan."}</p><p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">Didaftarkan {formatApplicationTime(application.created_at)}</p></section>
      </div>
      <aside className="h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="font-bold text-slate-950">Tindakan review</h2><p className="mt-1 text-xs leading-5 text-slate-600">Tinjau dokumen dan hasil seleksi sebelum memperbarui status pendaftaran.</p><div className="mt-4"><ApplicationStatusForm id={application.id} status={application.status} selectionStatus={application.selection_status ?? null} onboardingStatus={application.onboarding_status} convertedInternId={application.converted_intern_id} /></div></aside>
    </div>
  </main>;
}
