import { getMentorDailyReports, getMentorProfileId } from "@/features/daily-reports/queries";
import { MentorReportsManager } from "@/features/daily-reports/MentorReportsManager";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

type PageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function MentorDailyReportsPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const mentorProfileId = await getMentorProfileId(user.id);

  if (!mentorProfileId) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="surface p-6 text-sm font-semibold text-red-700">
          Profil mentor belum ditemukan. Hubungi admin untuk setup profil.
        </div>
      </main>
    );
  }

  const { data: reports, error } = await getMentorDailyReports(mentorProfileId);

  const pendingCount = (reports || []).filter((r) => r.status === "submitted").length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 relative">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Mentor</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Review Daily Report</h1>
          <p className="mt-2 max-w-2xl leading-7 text-slate-600">
            Laporan harian dari peserta bimbingan. Setujui atau minta revisi untuk setiap laporan.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="status-pill">{(reports || []).length} laporan</span>
          {pendingCount > 0 ? (
            <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800 animate-pulse">
              {pendingCount} menunggu review
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="surface p-4 text-sm font-semibold text-red-700 mb-6">
          Gagal memuat laporan. Cek koneksi database.
        </div>
      ) : null}

      <MentorReportsManager reports={reports || []} />
    </main>
  );
}
