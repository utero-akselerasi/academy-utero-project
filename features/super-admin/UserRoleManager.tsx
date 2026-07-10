"use client";

import { 
  assignUserRoleAction, 
  removeUserRoleAction, 
  createUserManualAction, 
  updateUserAdminAction,
  resetUserPasswordAction,
  deleteUserAction
} from "@/features/super-admin/actions";
import { type Role, type UserProfile, type UserRole } from "@/features/super-admin/types";
import { 
  Plus, X, UserPlus, Trash2, Edit2, Settings, Save, 
  MoreVertical, Key, Shield, User, Search, Calendar, 
  Check, ChevronDown, Clock, GraduationCap
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

type Props = {
  profiles: UserProfile[];
  roles: Role[];
  userRoles: UserRole[];
  schools?: Array<{ id: string, name: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function UserRoleManager({ profiles, roles, userRoles, schools = [] }: Props) {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loginFilter, setLoginFilter] = useState("all");

  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; left: number } | null>(null);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [changingRoleUser, setChangingRoleUser] = useState<UserProfile | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [linkingSchoolUser, setLinkingSchoolUser] = useState<UserProfile | null>(null);
  
  // Dropdown active state
  const [activeDropdownUserId, setActiveDropdownUserId] = useState<string | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdownUserId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const rolesByUser = new Map<string, UserRole[]>();
  for (const userRole of userRoles) {
    const current = rolesByUser.get(userRole.user_id) ?? [];
    current.push(userRole);
    rolesByUser.set(userRole.user_id, current);
  }

  // Filter logic
  const filteredProfiles = profiles.filter((profile) => {
    const assignedRoles = rolesByUser.get(profile.id) ?? [];
    
    // Search query match (name, email, phone)
    const matchesSearch = 
      profile.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (profile.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (profile.phone || "").includes(searchQuery);

    // Role filter match
    const matchesRole = 
      roleFilter === "all" ||
      (roleFilter === "norole" && assignedRoles.length === 0) ||
      assignedRoles.some(ur => ur.roles?.code === roleFilter);

    // Status filter match
    const matchesStatus = 
      statusFilter === "all" ||
      (statusFilter === "active" && profile.is_active) ||
      (statusFilter === "inactive" && !profile.is_active);

    // Login filter match
    const matchesLogin =
      loginFilter === "all" ||
      (loginFilter === "never" && !profile.last_sign_in_at) ||
      (loginFilter === "active" && !!profile.last_sign_in_at);

    return matchesSearch && matchesRole && matchesStatus && matchesLogin;
  });

  return (
    <div className="space-y-6">
      {/* Search & Filter & Add User Panel */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3 justify-between md:items-center">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Cari nama, email, atau telepon..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input !pl-9 text-sm w-full"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Filter Role */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border border-slate-200 rounded-lg text-xs px-2.5 bg-white h-9 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-slate-850 font-bold"
            >
              <option value="all">Semua Role</option>
              <option value="norole">Tanpa Role</option>
              {roles.map(r => (
                <option key={r.id} value={r.code}>{r.name}</option>
              ))}
            </select>

            {/* Filter Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-lg text-xs px-2.5 bg-white h-9 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-slate-850 font-bold"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>

            {/* Filter Login */}
            <select
              value={loginFilter}
              onChange={(e) => setLoginFilter(e.target.value)}
              className="border border-slate-200 rounded-lg text-xs px-2.5 bg-white h-9 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-slate-850 font-bold"
            >
              <option value="all">Semua Login</option>
              <option value="active">Pernah Login</option>
              <option value="never">Belum Pernah Login</option>
            </select>

            {/* Total Badge */}
            <span className="text-xs font-bold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg">
              Total: {filteredProfiles.length}
            </span>

            {/* Button Add User */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="button-primary text-xs py-1.5 h-9 min-h-0 flex items-center gap-1.5 font-bold rounded-lg ml-auto"
            >
              <UserPlus size={15} />
              <span>Add User</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabel Pengguna Premium */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider">
                <th className="p-4">Nama Pengguna</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Login Terakhir</th>
                <th className="p-4">Kontak / Label</th>
                <th className="p-4">Status</th>
                <th className="p-4">Bergabung</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 font-medium">
                    Tidak ditemukan data pengguna yang cocok.
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((profile) => {
                  const assignedRoles = rolesByUser.get(profile.id) ?? [];
                  const isIntern = assignedRoles.some(ur => ur.roles?.code === "intern");

                  return (
                    <tr key={profile.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-all">
                      <td className="p-4">
                        <div className="font-bold text-slate-900 leading-snug">{profile.full_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 select-all">{profile.id}</div>
                      </td>
                      <td className="p-4 text-slate-600 font-medium">{profile.email || "-"}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {assignedRoles.length === 0 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 border border-amber-200 text-amber-800 uppercase">
                              no role
                            </span>
                          ) : (
                            assignedRoles.map((ur) => (
                              <span 
                                key={ur.id}
                                className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-teal-50 border border-teal-200 text-teal-800 uppercase"
                              >
                                {ur.roles?.name || "Role"}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-slate-500 text-xs font-medium">
                        {formatDateTime(profile.last_sign_in_at)}
                      </td>
                      <td className="p-4">
                        <div className="text-xs text-slate-800 font-semibold">{profile.phone || "-"}</div>
                        {profile.school_name && (
                          <div className="text-[10px] text-teal-700 font-bold mt-1">Sekolah: {profile.school_name}</div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5">ID: {profile.id.slice(0, 8)}</div>
                      </td>
                      <td className="p-4">
                        <span className={"px-2 py-0.5 rounded text-[10px] font-extrabold uppercase " + (
                          profile.is_active 
                            ? "bg-teal-50 border border-teal-200 text-teal-800" 
                            : "bg-red-50 border border-red-200 text-red-700"
                        )}>
                          {profile.is_active ? "aktif" : "nonaktif"}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 text-xs font-semibold">
                        {formatDate(profile.created_at)}
                      </td>
                      <td className="p-4 text-center">
                        {/* Dropdown Menu Aksi ... */}
                        <div className="inline-block text-left">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeDropdownUserId === profile.id) {
                                setActiveDropdownUserId(null);
                                setDropdownCoords(null);
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setDropdownCoords({
                                  top: rect.bottom + window.scrollY,
                                  left: rect.right - 176 + window.scrollX // w-44 is 176px
                                });
                                setActiveDropdownUserId(profile.id);
                              }
                            }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-all"
                            title="Menu Aksi"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {activeDropdownUserId === profile.id && dropdownCoords && typeof document !== "undefined" && createPortal(
                            <div 
                              ref={dropdownRef}
                              style={{
                                position: "absolute",
                                top: `${dropdownCoords.top}px`,
                                left: `${dropdownCoords.left}px`,
                              }}
                              className="w-44 bg-white rounded-lg shadow-xl border border-slate-200 z-[9999] py-1 font-medium animate-in fade-in slide-in-from-top-1 duration-100"
                            >
                              <button
                                onClick={() => {
                                  setEditingProfile(profile);
                                  setActiveDropdownUserId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2"
                              >
                                <Edit2 size={13} />
                                <span>Edit Profil</span>
                              </button>

                              <button
                                onClick={() => {
                                  setChangingRoleUser(profile);
                                  setActiveDropdownUserId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2"
                              >
                                <Shield size={13} />
                                <span>Ubah Role</span>
                              </button>

                              <button
                                onClick={() => {
                                  setResetPasswordUser(profile);
                                  setActiveDropdownUserId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2"
                              >
                                <Key size={13} />
                                <span>Ubah Password</span>
                              </button>

                              {isIntern && (
                                <Link
                                  href={`/dashboard/super-admin/users/intern/${profile.id}`}
                                  className="w-full text-left px-4 py-2 text-xs text-teal-700 hover:bg-teal-50 hover:text-teal-900 flex items-center gap-2 block"
                                  onClick={() => setActiveDropdownUserId(null)}
                                >
                                  <User size={13} />
                                  <span>Lihat Profil Detail</span>
                                </Link>
                              )}

                              {assignedRoles.some(ur => ur.roles?.code === "school") && (
                                <button
                                  onClick={() => {
                                    setLinkingSchoolUser(profile);
                                    setActiveDropdownUserId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-xs text-indigo-750 hover:bg-indigo-50 hover:text-indigo-900 flex items-center gap-2"
                                >
                                  <GraduationCap size={13} />
                                  <span>Link Instansi / Sekolah</span>
                                </button>
                              )}

                              <div className="border-t border-slate-100 my-1"></div>

                              <button
                                onClick={() => {
                                  setDeletingUser(profile);
                                  setActiveDropdownUserId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-900 flex items-center gap-2"
                              >
                                <Trash2 size={13} />
                                <span>Hapus User</span>
                              </button>
                            </div>,
                            document.body
                          )}
                        </div>
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
            <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2 text-teal-700">
                <UserPlus size={20} />
                <h3 className="text-lg font-black text-slate-950">Tambah User Baru</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>

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
                <select className="form-input text-sm bg-white" id="manualRole" name="roleId">
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

      {/* POPUP MODAL EDIT PROFILE */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2 text-teal-700">
                <Settings size={20} />
                <h3 className="text-lg font-black text-slate-950">Edit Profil User</h3>
              </div>
              <button
                onClick={() => setEditingProfile(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <form 
              action={async (formData) => {
                try {
                  await updateUserAdminAction(formData);
                  setEditingProfile(null);
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Gagal mengupdate profil.");
                }
              }}
              className="p-6 space-y-4"
            >
              <input type="hidden" name="userId" value={editingProfile.id} />

              <div className="form-field">
                <label className="form-label text-xs" htmlFor="editName">Nama Lengkap *</label>
                <input 
                  className="form-input text-sm" 
                  id="editName" 
                  name="fullName" 
                  defaultValue={editingProfile.full_name} 
                  required 
                />
              </div>

              <div className="form-field">
                <label className="form-label text-xs" htmlFor="editPhone">Nomor Telepon/WA</label>
                <input 
                  className="form-input text-sm" 
                  id="editPhone" 
                  name="phone" 
                  defaultValue={editingProfile.phone || ""} 
                />
              </div>

              <div className="form-field">
                <label className="form-label text-xs" htmlFor="editStatus">Status Akun</label>
                <select 
                  className="form-input text-sm bg-white" 
                  id="editStatus" 
                  name="isActive" 
                  defaultValue={editingProfile.is_active ? "true" : "false"}
                >
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="button-secondary text-sm font-semibold"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="button-primary text-sm font-semibold flex items-center gap-1.5"
                >
                  <Save size={16} />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL CHANGE ROLE */}
      {changingRoleUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2 text-teal-700">
                <Shield size={20} />
                <h3 className="text-lg font-black text-slate-950 font-bold">Ubah Role Pengguna</h3>
              </div>
              <button
                onClick={() => setChangingRoleUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Pengguna</p>
                <p className="text-sm font-bold text-slate-800">{changingRoleUser.full_name}</p>
                <p className="text-[11px] text-slate-500 font-mono">{changingRoleUser.email}</p>
              </div>

              {/* Role Saat Ini */}
              <div className="space-y-2">
                <p className="text-xs text-slate-400 font-bold uppercase">Role Terpasang (Klik X untuk Hapus)</p>
                <div className="flex flex-wrap gap-2">
                  {(rolesByUser.get(changingRoleUser.id) ?? []).length === 0 ? (
                    <span className="text-xs text-slate-500 italic">Belum ada role terpasang.</span>
                  ) : (
                    (rolesByUser.get(changingRoleUser.id) ?? []).map((ur) => (
                      <form action={removeUserRoleAction} key={ur.id} className="inline-block" onSubmit={() => setTimeout(() => setChangingRoleUser(null), 100)}>
                        <input name="id" type="hidden" value={ur.id} />
                        <button 
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-red-50 border border-red-200 text-red-700 text-xs font-bold hover:bg-red-100 transition-all uppercase"
                          type="submit"
                          title="Klik untuk menghapus role"
                        >
                          <span>{ur.roles?.name || "Role"}</span>
                          <X size={12} className="shrink-0" />
                        </button>
                      </form>
                    ))
                  )}
                </div>
              </div>

              {/* Tambah Role Baru */}
              <form 
                action={assignUserRoleAction} 
                className="space-y-3 pt-4 border-t border-slate-100"
                onSubmit={() => setTimeout(() => setChangingRoleUser(null), 100)}
              >
                <input name="userId" type="hidden" value={changingRoleUser.id} />
                <div className="form-field">
                  <label className="form-label text-xs" htmlFor="assignRoleSelect">Tambah Role Baru</label>
                  <div className="flex gap-2">
                    <select 
                      className="form-input text-sm flex-1 bg-white" 
                      id="assignRoleSelect"
                      name="roleId" 
                      required
                    >
                      <option value="">Pilih Role...</option>
                      {roles
                        .filter(r => !(rolesByUser.get(changingRoleUser.id) ?? []).some(ur => ur.role_id === r.id))
                        .map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                    </select>
                    <button 
                      className="button-primary text-sm px-4 min-h-0 flex items-center justify-center shrink-0" 
                      type="submit"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </form>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setChangingRoleUser(null)}
                  className="button-secondary text-sm font-semibold"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL RESET PASSWORD */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2 text-teal-700">
                <Key size={20} />
                <h3 className="text-lg font-black text-slate-950 font-bold">Reset Password User</h3>
              </div>
              <button
                onClick={() => setResetPasswordUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <form 
              action={async (formData) => {
                try {
                  await resetUserPasswordAction(formData);
                  alert("Password berhasil diubah!");
                  setResetPasswordUser(null);
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Gagal mereset password.");
                }
              }}
              className="p-6 space-y-4"
            >
              <input type="hidden" name="userId" value={resetPasswordUser.id} />

              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Pengguna</p>
                <p className="text-sm font-bold text-slate-800">{resetPasswordUser.full_name}</p>
                <p className="text-[11px] text-slate-500 font-mono">{resetPasswordUser.email}</p>
              </div>

              <div className="form-field">
                <label className="form-label text-xs" htmlFor="resetPwdVal">Password Baru *</label>
                <input 
                  className="form-input text-sm" 
                  id="resetPwdVal" 
                  name="password" 
                  type="password"
                  placeholder="Ketik password baru minimal 6 karakter..." 
                  required 
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  className="button-secondary text-sm font-semibold"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="button-primary text-sm font-semibold flex items-center gap-1.5"
                >
                  <Save size={16} />
                  <span>Ubah Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL LINK SCHOOL / INSTANSI */}
      {linkingSchoolUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2 text-teal-700">
                <GraduationCap size={20} />
                <h3 className="text-lg font-black text-slate-950 font-bold">Hubungkan Instansi / Sekolah</h3>
              </div>
              <button
                onClick={() => setLinkingSchoolUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <form 
              action={async (formData) => {
                try {
                  const { linkSchoolContactAction } = await import("@/features/super-admin/actions");
                  await linkSchoolContactAction(formData);
                  alert("Instansi berhasil dihubungkan!");
                  setLinkingSchoolUser(null);
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Gagal menghubungkan instansi.");
                }
              }}
              className="p-6 space-y-4"
            >
              <input type="hidden" name="userId" value={linkingSchoolUser.id} />

              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Nama Pengguna</p>
                <p className="text-sm font-bold text-slate-800">{linkingSchoolUser.full_name}</p>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{linkingSchoolUser.email}</p>
              </div>

              <div className="form-field">
                <label className="form-label text-xs font-bold text-slate-700" htmlFor="linkSchoolSelect">Pilih Instansi / Sekolah *</label>
                <select 
                  className="form-input text-sm bg-white" 
                  id="linkSchoolSelect" 
                  name="schoolId"
                  required
                >
                  <option value="">-- Pilih Sekolah/Kampus --</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label className="form-label text-xs font-bold text-slate-700" htmlFor="linkPositionInput">Jabatan Perwakilan</label>
                <input 
                  className="form-input text-sm" 
                  id="linkPositionInput" 
                  name="position" 
                  placeholder="Contoh: Kepala Humas / Koordinator Magang" 
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLinkingSchoolUser(null)}
                  className="button-secondary text-sm font-semibold"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="button-primary text-sm font-semibold flex items-center gap-1.5"
                >
                  <Save size={16} />
                  <span>Hubungkan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL CONFIRM DELETE */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between bg-red-50 px-6 py-4 border-b border-red-200">
              <div className="flex items-center gap-2 text-red-700">
                <Trash2 size={20} />
                <h3 className="text-lg font-black text-red-950 font-bold">Hapus Pengguna</h3>
              </div>
              <button
                onClick={() => setDeletingUser(null)}
                className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-100/50 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <form 
              action={async (formData) => {
                try {
                  await deleteUserAction(formData);
                  alert("User berhasil dihapus!");
                  setDeletingUser(null);
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Gagal menghapus user.");
                }
              }}
              className="p-6 space-y-4"
            >
              <input type="hidden" name="userId" value={deletingUser.id} />

              <div className="bg-red-50 text-red-800 p-4 rounded-lg text-xs leading-relaxed border border-red-100">
                <strong>Peringatan!</strong> Menghapus user ini akan menghapus akun autentikasi beserta seluruh data profil, absensi, daily report, dan tugas yang berelasi secara permanen. Tindakan ini tidak dapat dibatalkan.
              </div>

              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Nama Pengguna</p>
                <p className="text-sm font-bold text-slate-800">{deletingUser.full_name}</p>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{deletingUser.email}</p>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeletingUser(null)}
                  className="button-secondary text-sm font-semibold"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="button-primary bg-red-600 hover:bg-red-700 border-red-600 text-sm font-semibold flex items-center gap-1.5 text-white"
                >
                  <Trash2 size={16} />
                  <span>Hapus Permanen</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
