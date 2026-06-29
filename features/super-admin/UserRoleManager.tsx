import { assignUserRoleAction, removeUserRoleAction } from "@/features/super-admin/actions";
import { type Role, type UserProfile, type UserRole } from "@/features/super-admin/types";
import { Plus, X } from "lucide-react";

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
    <div className="grid gap-4">
      {profiles.length === 0 ? (
        <div className="surface p-8 text-center text-slate-600">
          Belum ada user profile. Tambahkan data di `utero_academy.user_profiles` setelah user dibuat di Supabase Auth.
        </div>
      ) : null}

      {profiles.map((profile) => {
        const assignedRoles = rolesByUser.get(profile.id) ?? [];

        return (
          <article className="surface p-5" key={profile.id}>
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
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
                  {assignedRoles.length === 0 ? <span className="status-pill">belum ada role</span> : null}
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

              <form action={assignUserRoleAction} className="grid content-start gap-3 rounded-lg border border-slate-200 p-4">
                <input name="userId" type="hidden" value={profile.id} />
                <label className="form-field">
                  <span className="form-label">Assign role</span>
                  <select className="form-input" name="roleId" required>
                    <option value="">Pilih role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button-primary" type="submit">
                  <Plus size={18} />
                  Tambahkan role
                </button>
              </form>
            </div>
          </article>
        );
      })}
    </div>
  );
}

