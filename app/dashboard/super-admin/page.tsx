import { requireSuperAdmin } from "@/features/auth/guards";
import Link from "next/link";

export default async function SuperAdminDashboardPage() {
  await requireSuperAdmin();

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-5 sm:px-6">
      <header className="rounded-2xl bg-slate-950 p-5 text-white shadow-lg sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-300">Super Admin / ringkasan</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Pusat kendali platform</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">Pilih area pengelolaan untuk mengatur akun, instansi, pendaftaran, dan audit platform.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Link className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-red-300 hover:shadow-md" href="/dashboard/admin/pendaftaran">
          <h2 className="font-bold text-slate-950">Review Pendaftaran</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Buka antrean pendaftaran yang sudah berjalan di dashboard admin.
          </p>
        </Link>
        <Link className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-red-300 hover:shadow-md" href="/dashboard/super-admin/users">
          <h2 className="font-bold text-slate-950">User Management</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Lihat user profile dan assign role user tanpa membuka database langsung.
          </p>
        </Link>
        <Link className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-red-300 hover:shadow-md" href="/dashboard/super-admin/schools">
          <h2 className="font-bold text-slate-950">Manajemen Instansi</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Tambah sekolah/kampus partner dan cek perwakilan yang terhubung ke School Portal.
          </p>
        </Link>
        <Link className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-red-300 hover:shadow-md" href="/dashboard/super-admin/orphan-cleanup">
          <h2 className="font-bold text-slate-950">Cleanup Orphan</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Deteksi dan bersihkan relasi data yang sudah tidak valid.
          </p>
        </Link>
        <Link className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-red-300 hover:shadow-md" href="/dashboard/super-admin/audit-logs">
          <h2 className="font-bold text-slate-950">Audit Log</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Lihat riwayat log aktivitas penting dari admin, mentor, dan sistem untuk audit keamanan.
          </p>
        </Link>
      </div>
    </main>
  );
}
