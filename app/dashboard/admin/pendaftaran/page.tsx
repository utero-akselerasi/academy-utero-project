import { ApplicationStatusForm } from "@/features/admin/ApplicationStatusForm";
import { type InternshipApplication } from "@/features/admin/types";
import { applicationStatusLabel, formatApplicationDate, formatApplicationTime } from "@/features/admin/application-display";
import { requireAdmin } from "@/features/auth/guards";
import { resolveStorageUrl } from "@/lib/storage-urls";
import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { usesLocalBackend } from "@/lib/backend/server";
import { getLocalApplications } from "@/features/admin/local";

export default async function AdminApplicationsPage() {
  await requireAdmin();
  const local = usesLocalBackend() ? await getLocalApplications() as { applications: Array<InternshipApplication & { onboarding_status: string | null; converted_intern_id: string | null }> } : null;
  const db = local ? null : await createUteroAcademyServiceRoleClient();
  const { data, error } = local ? { data: local.applications, error: null } : await db!
    .from("internship_applications")
    .select("id, full_name, email, phone, school_name, major, motivation, status, selection_status, onboarding_status, proposed_start_date, proposed_end_date, approved_start_date, approved_end_date, applicant_user_id, converted_intern_id, cv_path, portfolio_path, created_at")
    .order("created_at", { ascending: false })
    .returns<Array<InternshipApplication & { onboarding_status: string | null; converted_intern_id: string | null }>>();

  const applications = data ?? [];
  const fileUrls = await Promise.all(applications.map(async (item) => ({
    cv: await resolveStorageUrl("academy-private", item.cv_path),
    portfolio: await resolveStorageUrl("academy-private", item.portfolio_path),
  })));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-7 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Seleksi administrasi</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Pendaftaran masuk</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Tinjau data dan dokumen setiap pelamar, lalu tandai sudah ditinjau, terima, atau tolak.</p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-800 ring-1 ring-inset ring-teal-200">{applications.length} pelamar</span>
      </header>

      {error ? <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">Data pendaftaran belum dapat dimuat. Periksa akses admin dan koneksi backend.</div> : null}

      <div className="grid gap-5">
        {applications.length === 0 && !error ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">Belum ada pendaftaran masuk.</div> : null}

        {applications.map((item, index) => (
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" key={item.id}>
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pelamar</p><h2 className="mt-1 text-xl font-bold text-slate-950">{item.full_name}</h2></div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{applicationStatusLabel(item.status)}</span>
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">Seleksi: {applicationStatusLabel(item.selection_status)}</span>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">Onboarding: {applicationStatusLabel(item.onboarding_status)}</span>
              </div>
            </div>

            <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem]">
              <div className="space-y-6 p-5 sm:p-6">
                <section aria-labelledby={`contact-${item.id}`}>
                  <h3 id={`contact-${item.id}`} className="text-xs font-bold uppercase tracking-wider text-slate-500">Identitas & kontak</h3>
                  <dl className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    <div className="min-w-0"><dt className="text-xs font-medium text-slate-500">Email</dt><dd className="mt-1 break-all text-sm font-medium text-slate-900">{item.email}</dd></div>
                    <div><dt className="text-xs font-medium text-slate-500">WhatsApp</dt><dd className="mt-1 text-sm font-medium text-slate-900">{item.phone ?? "-"}</dd></div>
                    <div><dt className="text-xs font-medium text-slate-500">Sekolah / kampus</dt><dd className="mt-1 text-sm font-medium text-slate-900">{item.school_name ?? "-"}</dd></div>
                    <div><dt className="text-xs font-medium text-slate-500">Jurusan</dt><dd className="mt-1 text-sm font-medium text-slate-900">{item.major ?? "-"}</dd></div>
                  </dl>
                </section>

                <section aria-labelledby={`period-${item.id}`}>
                  <h3 id={`period-${item.id}`} className="text-xs font-bold uppercase tracking-wider text-slate-500">Periode magang</h3>
                  <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Periode usulan</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{formatApplicationDate(item.proposed_start_date)} – {formatApplicationDate(item.proposed_end_date)}</dd></div>
                    {item.approved_start_date || item.approved_end_date ? <div className="rounded-xl bg-teal-50 p-3"><dt className="text-xs text-teal-700">Periode disetujui</dt><dd className="mt-1 text-sm font-semibold text-teal-950">{formatApplicationDate(item.approved_start_date)} – {formatApplicationDate(item.approved_end_date)}</dd></div> : null}
                  </dl>
                </section>

                <section aria-labelledby={`files-${item.id}`}>
                  <h3 id={`files-${item.id}`} className="text-xs font-bold uppercase tracking-wider text-slate-500">Dokumen pelamar</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {fileUrls[index].cv ? <a href={fileUrls[index].cv!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-teal-800 transition hover:border-teal-300 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">Lihat / unduh CV</a> : <span className="text-sm text-slate-500">CV tidak tersedia</span>}
                    {fileUrls[index].portfolio ? <a href={fileUrls[index].portfolio!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-teal-800 transition hover:border-teal-300 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">Lihat / unduh portofolio</a> : null}
                  </div>
                </section>

                <section aria-labelledby={`motivation-${item.id}`}>
                  <h3 id={`motivation-${item.id}`} className="text-xs font-bold uppercase tracking-wider text-slate-500">Motivasi</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.motivation || "Tidak ada motivasi yang dicantumkan."}</p>
                </section>
                <p className="border-t border-slate-100 pt-4 text-xs text-slate-500">Didaftarkan {formatApplicationTime(item.created_at)}</p>
              </div>

              <aside className="border-t border-slate-200 bg-slate-50/80 p-5 sm:p-6 lg:border-l lg:border-t-0">
                <h3 className="text-sm font-bold text-slate-950">Tindakan review</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">Tinjau data, selesaikan seleksi, lalu terima pelamar untuk membuat profil peserta magang.</p>
                <div className="mt-4"><ApplicationStatusForm id={item.id} status={item.status} selectionStatus={item.selection_status ?? null} onboardingStatus={item.onboarding_status} convertedInternId={item.converted_intern_id} /></div>
              </aside>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}