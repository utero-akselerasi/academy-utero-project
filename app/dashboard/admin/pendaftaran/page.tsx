import { ApplicationStatusForm } from "@/features/admin/ApplicationStatusForm";
import { type InternshipApplication } from "@/features/admin/types";
import { createUteroAcademyClient } from "@/lib/supabase/server";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminApplicationsPage() {
  const db = await createUteroAcademyClient();
  const { data, error } = await db
    .from("internship_applications")
    .select("id, full_name, email, phone, school_name, major, motivation, status, created_at")
    .order("created_at", { ascending: false })
    .returns<InternshipApplication[]>();

  const applications = data ?? [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Review Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Pendaftaran Masuk</h1>
          <p className="mt-2 text-slate-600">
            Data diambil dari `utero_academy.internship_applications`.
          </p>
        </div>
        <span className="status-pill">{applications.length} data</span>
      </div>

      {error ? (
        <div className="surface p-4 text-sm font-semibold text-red-700">
          Data belum bisa dibaca. Cek policy RLS untuk role admin.
        </div>
      ) : null}

      <div className="grid gap-4">
        {applications.length === 0 && !error ? (
          <div className="surface p-8 text-center text-slate-600">Belum ada pendaftaran masuk.</div>
        ) : null}

        {applications.map((item) => (
          <article className="surface p-5" key={item.id}>
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-950">{item.full_name}</h2>
                  <span className="status-pill">{item.status}</span>
                </div>
                <dl className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                  <div>
                    <dt className="font-bold text-slate-950">Email</dt>
                    <dd>{item.email}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-950">WhatsApp</dt>
                    <dd>{item.phone ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-950">Sekolah</dt>
                    <dd>{item.school_name ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-950">Jurusan</dt>
                    <dd>{item.major ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-950">Tanggal daftar</dt>
                    <dd>{formatDate(item.created_at)}</dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <h3 className="text-sm font-bold text-slate-950">Motivasi</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.motivation ?? "-"}</p>
                </div>
              </div>

              <ApplicationStatusForm id={item.id} />
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

