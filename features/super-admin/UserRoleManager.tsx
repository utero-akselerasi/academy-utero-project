import { assignUserRoleAction, removeUserRoleAction, createUserManualAction } from "@/features/super-admin/actions";
import { type Role, type UserProfile, type UserRole } from "@/features/super-admin/types";
import { Plus, X, UserPlus } from "lucide-react";

type Props = {
  profiles: UserProfile[];
  roles: Role[];
  userRoles: UserRole[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function UserRoleManager({ profiles, roles, userRoles }: Props) {
  const rolesByUser = new Map<string, UserRole[]>();

  for (const userRole of userRoles) {
    const current = rolesByUser.get(userRole.user_id) ?? [];
    current.push(userRole);
    rolesByUser.set(userRole.user_id, current);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      {/* Kolom Kiri: Daftar User */}
      <div>
        <h2 className="mb-4 text-lg font-bold text-slate-950">Daftar Pengguna ({profiles.length})</h2>
        <div className="grid gap-4">
          {profiles.length === 0 ? (
            <div className="surface p-8 text-center text-slate-600">
              Belum ada user profile. Tambahkan data di sebelah kanan.
            </div>
          ) : null}

          {profiles.map((profile) => {
            const assignedRoles = rolesByUser.get(profile.id) ?? [];

            return (
              <article className="surface p-5" key={profile.id}>
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-bold text-slate-950">{profile.full_name}</h2>
                      <span className="status-pill">{profile.is_active ? "aktif" : "nonaktif"}</span>
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                      <div>
                        <dt className="font-bold text-slate-950">User ID</dt>
                        <dd className="break-all">{profile.id}</dd>
                      </div>
                      <div>
                        <dt className="font-bold text-slate-950">Telepon</dt>
                        <dd>{profile.phone ?? "-"}</dd>
                      </div>
                      <div>
                        <dt className="font-bold text-slate-950">Dibuat</dt>
                        <dd>{formatDate(profile.created_at)}</dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {assignedRoles.length === 0 ? <span className="status-pill text-amber-700 bg-amber-50 border-amber-300">belum ada role</span> : null}
                      {assignedRoles.map((userRole) => (
                        <form action={removeUserRoleAction} key={userRole.id}>
                          <input name="id" type="hidden" value={userRole.id} />
                          <button className="button-secondary text-sm" type="submit">
                            {userRole.roles?.name ?? "Role"}
                            <X size={14} />
                          </button>
                        </form>
                      ))}
                    </div>
                  </div>

                  <form action={assignUserRoleAction} className="grid content-start gap-2 rounded-lg border border-slate-200 p-3 bg-slate-50 w-full lg:w-64 mt-4 lg:mt-0">
                    <input name="userId" type="hidden" value={profile.id} />
                    <label className="form-field">
                      <span className="form-label text-xs">Assign Role</span>
                      <select className="form-input text-xs py-2" name="roleId" required>
                        <option value="">Pilih role...</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="button-primary text-xs py-2 min-h-0" type="submit">
                      <Plus size={14} />
                      Tambah Role
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Kolom Kanan: Buat User Manual */}
      <div>
        <h2 className="mb-4 text-lg font-bold text-slate-950">Tambah User Baru Manual</h2>
        <form action={createUserManualAction} className="surface grid gap-4 p-5">
          <div className="flex items-center gap-2 text-teal-700 mb-2">
            <UserPlus size={20} />
            <span className="font-bold text-sm">Pembuatan Akun Tanpa Database</span>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="manualName">Nama Lengkap *</label>
            <input className="form-input" id="manualName" name="fullName" placeholder="Contoh: Budi Santoso" required />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="manualEmail">Email Address *</label>
            <input className="form-input" id="manualEmail" name="email" type="email" placeholder="budi@example.com" required />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="manualPassword">Password *</label>
            <input className="form-input" id="manualPassword" name="password" type="password" placeholder="Minimal 6 karakter..." required />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="manualPhone">Nomor Telepon/WA</label>
            <input className="form-input" id="manualPhone" name="phone" placeholder="Contoh: 08123456789" />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="manualRole">Default Role</label>
            <select className="form-input" id="manualRole" name="roleId">
              <option value="">Tanpa Role (Bisa diset nanti)</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          <button className="button-primary w-full" type="submit">
            <Plus size={16} />
            Buat Akun & Profil
          </button>
        </form>
      </div>
    </div>
  );
}
