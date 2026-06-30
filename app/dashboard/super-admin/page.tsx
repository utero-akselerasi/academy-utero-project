import Link from "next/link";

export default function SuperAdminDashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase text-teal-700">Super Admin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Pusat Kendali Platform</h1>
        <p className="mt-2 max-w-2xl leading-7 text-slate-600">
          Area ini disiapkan untuk manajemen user, role, permission, dan konfigurasi global platform.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link className="surface block p-5 hover:border-teal-500" href="/dashboard/admin/pendaftaran">
          <h2 className="font-bold text-slate-950">Review Pendaftaran</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Buka antrean pendaftaran yang sudah berjalan di dashboard admin.
          </p>
        </Link>
        <Link className="surface block p-5 hover:border-teal-500" href="/dashboard/super-admin/users">
          <h2 className="font-bold text-slate-950">User Management</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Lihat user profile dan assign role user tanpa membuka database langsung.
          </p>
        </Link>
        <Link className="surface block p-5 hover:border-teal-500" href="/dashboard/super-admin/audit-logs">
          <h2 className="font-bold text-slate-950">Audit Log</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Lihat riwayat log aktivitas penting dari admin, mentor, dan sistem untuk audit keamanan.
          </p>
        </Link>
      </div>
    </main>
  );
}
