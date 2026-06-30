"use client";

import { assignUserRoleAction, removeUserRoleAction, createUserManualAction } from "@/features/super-admin/actions";
import { type Role, type UserProfile, type UserRole } from "@/features/super-admin/types";
import { Plus, X, UserPlus, Trash2 } from "lucide-react";
import { useState } from "react";

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
  const [isModalOpen, setIsModalOpen] = useState(false);

  const rolesByUser = new Map<string, UserRole[]>();
  for (const userRole of userRoles) {
    const current = rolesByUser.get(userRole.user_id) ?? [];
    current.push(userRole);
    rolesByUser.set(userRole.user_id, current);
  }

  return (
    <div className="space-y-6">
      {/* Tombol Add User */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <span className="text-sm font-bold text-slate-500">Total Pengguna: {profiles.length}</span>
        <button
          onClick={() => setIsModalOpen(true)}
          className="button-primary text-xs py-2 min-h-0 flex items-center gap-1.5 font-bold"
        >
          <UserPlus size={15} />
          <span>Add User</span>
        </button>
      </div>

      {/* Tabel Pengguna */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs">
                <th className="p-4">Nama Pengguna</th>
                <th className="p-4">WhatsApp / Telp</th>
                <th className="p-4">Role Saat Ini</th>
                <th className="p-4">Tambah Role</th>
                <th className="p-4">Tanggal Dibuat</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Belum ada data user profile.
                  </td>
                </tr>
              ) : (
                profiles.map((profile) => {
                  const assignedRoles = rolesByUser.get(profile.id) ?? [];

                  return (
                    <tr key={profile.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-all">
                      <td className="p-4">
                        <div className="font-bold text-slate-900 leading-snug">{profile.full_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 select-all">{profile.id}</div>
                      </td>
                      <td className="p-4 text-slate-600 font-semibold">{profile.phone || "-"}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {assignedRoles.length === 0 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-800 uppercase">
                              no role
                            </span>
                          ) : (
                            assignedRoles.map((ur) => (
                              <form action={removeUserRoleAction} key={ur.id} className="inline-block">
                                <input name="id" type="hidden" value={ur.id} />
                                <button 
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 border border-teal-200 text-teal-800 hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-all uppercase"
                                  type="submit"
                                  title="Hapus Role"
                                >
                                  <span>{ur.roles?.name || "Role"}</span>
                                  <X size={10} className="shrink-0" />
                                </button>
                              </form>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <form action={assignUserRoleAction} className="flex gap-1 max-w-[200px]">
                          <input name="userId" type="hidden" value={profile.id} />
                          <select 
                            className="form-input text-xs py-1 px-2 h-8 w-full min-w-[130px] flex-1 bg-white" 
                            name="roleId" 
                            required
                          >
                            <option value="">Pilih...</option>
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                          <button 
                            className="button-primary text-xs h-8 py-0 px-2 min-h-0 flex items-center justify-center shrink-0" 
                            type="submit"
                          >
                            <Plus size={14} />
                          </button>
                        </form>
                      </td>
                      <td className="p-4 text-slate-500 text-xs font-semibold">{formatDate(profile.created_at)}</td>
                      <td className="p-4">
                        <span className={"px-2 py-0.5 rounded text-[10px] font-bold uppercase " + (
                          profile.is_active 
                            ? "bg-teal-50 border border-teal-200 text-teal-800" 
                            : "bg-slate-100 border border-slate-300 text-slate-600"
                        )}>
                          {profile.is_active ? "aktif" : "nonaktif"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POPUP MODAL ADD USER */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2 text-teal-700">
                <UserPlus size={20} />
                <h3 className="text-lg font-black text-slate-900">Tambah User Baru</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Modal */}
            <form 
              action={async (formData) => {
                try {
                  await createUserManualAction(formData);
                  setIsModalOpen(false);
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Gagal membuat user.");
                }
              }}
              className="p-6 space-y-4"
            >
              <div className="form-field">
                <label className="form-label text-xs" htmlFor="manualName">Nama Lengkap *</label>
                <input className="form-input text-sm" id="manualName" name="fullName" placeholder="Contoh: Budi Santoso" required />
              </div>

              <div className="form-field">
                <label className="form-label text-xs" htmlFor="manualEmail">Email Address *</label>
                <input className="form-input text-sm" id="manualEmail" name="email" type="email" placeholder="budi@example.com" required />
              </div>

              <div className="form-field">
                <label className="form-label text-xs" htmlFor="manualPassword">Password *</label>
                <input className="form-input text-sm" id="manualPassword" name="password" type="password" placeholder="Minimal 6 karakter..." required />
              </div>

              <div className="form-field">
                <label className="form-label text-xs" htmlFor="manualPhone">Nomor Telepon/WA</label>
                <input className="form-input text-sm" id="manualPhone" name="phone" placeholder="Contoh: 08123456789" />
              </div>

              <div className="form-field">
                <label className="form-label text-xs" htmlFor="manualRole">Default Role</label>
                <select className="form-input text-sm" id="manualRole" name="roleId">
                  <option value="">Tanpa Role (Bisa diset nanti)</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="button-secondary text-sm font-semibold"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="button-primary text-sm font-semibold flex items-center gap-1"
                >
                  <Plus size={16} />
                  <span>Buat Akun</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
