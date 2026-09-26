import { requireAdmin } from "@/features/auth/guards";
import { resolveStaffInternScope } from "@/features/auth/scope";
import { getMentorDailyReports } from "@/features/daily-reports/queries";
import { MentorReportsManager } from "@/features/daily-reports/MentorReportsManager";
import Link from "next/link";

export default async function MentorDailyReportsPage() {
  const user = await requireAdmin();

  // Bacaan dibatasi scope yang sama dengan aksi review-nya: admin hanya melihat
  // peserta bimbingannya, super_admin global. Sebelumnya halaman ini memuat
  // laporan seluruh peserta aktif.
  const scope = await resolveStaffInternScope(user.id);

  if (scope.kind === "setup_required") {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="surface p-6 text-sm font-semibold text-red-700">
          Profil pembimbing belum ditemukan. Hubungi super admin untuk setup profil.
        </div>
      </main>
    );
  }

  const { data: reports, error } = await getMentorDailyReports(
    scope.kind === "global" ? null : scope.internIds,
  );

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
