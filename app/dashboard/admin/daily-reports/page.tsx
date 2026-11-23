import { requireAdmin } from "@/features/auth/guards";
import { resolveStaffInternScope } from "@/features/auth/scope";
import { getAdminDailyReports } from "@/features/daily-reports/queries";
import { DailyReportsManager } from "@/features/daily-reports/DailyReportsManager";
import Link from "next/link";
import { usesLocalBackend } from "@/lib/backend/mode";

type PageProps = { searchParams: Promise<{ page?: string }> };

export default async function AdminDailyReportsPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam || "1", 10) || 1);
  const pageSize = 50;
  const user = await requireAdmin();

  // Bacaan dibatasi scope yang sama dengan aksi review-nya: admin hanya melihat
  // peserta magangnya, super_admin global. Sebelumnya halaman ini memuat
  // laporan seluruh peserta aktif.
  const scope = usesLocalBackend() ? null : await resolveStaffInternScope(user.id);

  if (scope?.kind === "setup_required") {
    return (
      <main className="w-full px-3 py-4 sm:px-4 sm:py-5">
        <div className="surface p-6 text-sm font-semibold text-red-700">
          Akun admin tidak memiliki akses ke halaman ini.
        </div>
      </main>
    );
  }

  const { data: reports, error } = await getAdminDailyReports(
    !scope || scope.kind === "global" ? null : scope.internIds,
    page,
    pageSize,
  );

  const pendingCount = (reports || []).filter((r) => r.status === "submitted").length;

  return (
    <main className="w-full px-3 py-4 sm:px-4 sm:py-5 relative">
      <div className="mb-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">ADMINISTRATOR</p>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-950">Review Daily Report</h1>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
            Laporan harian dari peserta magang. Setujui atau minta revisi untuk setiap laporan.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="status-pill">{(reports || []).length} laporan pada halaman {page}</span>
          {pendingCount > 0 ? (
            <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800 animate-pulse">
              {pendingCount} menunggu review pada halaman ini
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="surface p-4 text-sm font-semibold text-red-700 mb-6">
          Gagal memuat laporan. Cek koneksi database.
        </div>
      ) : null}

      <DailyReportsManager reports={reports || []} />
      <nav aria-label="Halaman laporan harian admin" className="mt-6 flex items-center justify-end gap-3 text-sm">
        {page > 1 && <Link className="button-secondary" href={`/dashboard/admin/daily-reports?page=${page - 1}`}>Sebelumnya</Link>}
        <span>Halaman {page}</span>
        {(reports || []).length === pageSize && <Link className="button-secondary" href={`/dashboard/admin/daily-reports?page=${page + 1}`}>Berikutnya</Link>}
      </nav>
    </main>
  );
}
