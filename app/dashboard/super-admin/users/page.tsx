export const dynamic = "force-dynamic";

import { UserRoleManager } from "@/features/super-admin/UserRoleManager";
import { getSuperAdminUserManagementData } from "@/features/super-admin/queries";
import { requireSuperAdmin } from "@/features/auth/guards";
import Link from "next/link";

export default async function SuperAdminUsersPage() {
  // Guard sebelum fetch: data user/role dibaca via service role, jadi layout
  // saja tidak cukup sebagai batas keamanan.
  await requireSuperAdmin();

  const { profiles, roles, userRoles, schools, error } = await getSuperAdminUserManagementData();

  return (
    <main className="w-full px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Super Admin</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">User dan Role</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Kelola akun, status, dan role pengguna.
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="button-secondary" href="/dashboard/super-admin/schools">
            Manajemen Instansi
          </Link>
          <Link className="button-secondary" href="/dashboard/super-admin">
            Kembali
          </Link>
        </div>
      </div>

      {error ? (
        <div className="surface mb-4 p-4 text-sm font-semibold text-red-700">
          Data belum bisa dibaca. Jalankan migration `0003_super_admin_user_management.sql` dan pastikan user memiliki role `super_admin`.
        </div>
      ) : null}

      <UserRoleManager profiles={profiles} roles={roles} userRoles={userRoles} schools={schools} isSuperAdmin />
    </main>
  );
}
