import { UserRoleManager } from "@/features/super-admin/UserRoleManager";
import { getSuperAdminUserManagementData } from "@/features/super-admin/queries";
import Link from "next/link";

export default async function SuperAdminUsersPage() {
  const { profiles, roles, userRoles, schools, error } = await getSuperAdminUserManagementData();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Super Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">User dan Role</h1>
          <p className="mt-2 max-w-2xl leading-7 text-slate-600">
            Kelola role aplikasi dari data `utero_academy.user_profiles`, `roles`, dan `user_roles`.
          </p>
        </div>
        <Link className="button-secondary" href="/dashboard/super-admin">
          Kembali
        </Link>
      </div>

      {error ? (
        <div className="surface mb-4 p-4 text-sm font-semibold text-red-700">
          Data belum bisa dibaca. Jalankan migration `0003_super_admin_user_management.sql` dan pastikan user memiliki role `super_admin`.
        </div>
      ) : null}

      <UserRoleManager profiles={profiles} roles={roles} userRoles={userRoles} schools={schools} />
    </main>
  );
}

