import Link from "next/link";
import {
  createSchoolAction,
  deleteSchoolAction,
  linkInternToSchoolAction,
  updateSchoolAction,
} from "@/features/super-admin/actions";
import { getSuperAdminSchoolsData } from "@/features/super-admin/queries";
import { SchoolInternSelector } from "@/features/super-admin/components/SchoolInternSelector";

function TextInput({ name, defaultValue, placeholder, required = false }: { name: string; defaultValue?: string | null; placeholder: string; required?: boolean }) {
  return (
    <input
      name={name}
      defaultValue={defaultValue || ""}
      placeholder={placeholder}
      required={required}
      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
    />
  );
}

export default async function SuperAdminSchoolsPage() {
  const { schools, contacts, interns, unassignedInterns, error } = await getSuperAdminSchoolsData();

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Super Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Manajemen Instansi</h1>
          <p className="mt-2 max-w-3xl leading-7 text-slate-600">
            Tambah sekolah/kampus partner, edit data instansi, link perwakilan, dan hubungkan siswa ke instansi School Portal.
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="button-secondary" href="/dashboard/super-admin/users">User Management</Link>
          <Link className="button-secondary" href="/dashboard/super-admin">Kembali</Link>
        </div>
      </div>

      {error ? (
        <div className="surface mb-4 p-4 text-sm font-semibold text-red-700">
          Data instansi belum bisa dibaca. Cek koneksi database atau policy tabel `schools`.
        </div>
      ) : null}

      <section className="surface mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-slate-950">Tambah Instansi Baru</h2>
        <p className="mt-1 text-sm text-slate-500">Setelah instansi dibuat, hubungkan user role `school` lewat User Management dan hubungkan siswa dari tabel di bawah.</p>
        <form action={createSchoolAction} className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <TextInput name="name" placeholder="Nama instansi *" required />
          <TextInput name="type" placeholder="Tipe: SMK / Universitas / Kampus" />
          <TextInput name="city" placeholder="Kota" />
          <TextInput name="province" placeholder="Provinsi" />
          <div className="lg:col-span-2"><TextInput name="address" placeholder="Alamat lengkap" /></div>
          <div className="lg:col-span-2"><TextInput name="logoPath" placeholder="Logo path / URL logo (opsional)" /></div>
          <button className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800" type="submit">
            Tambah Instansi
          </button>
        </form>
      </section>

      <section className="surface mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <h2 className="text-base font-black text-amber-950">Siswa Belum Terhubung</h2>
        <p className="mt-1 text-sm text-amber-800">Ada {unassignedInterns.length} siswa yang belum punya instansi. Gunakan form Link Siswa di daftar instansi.</p>
      </section>

      <section className="surface overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-black text-slate-950">Daftar Instansi</h2>
          <p className="text-sm text-slate-500">Total {schools.length} instansi terdaftar.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4">Instansi</th>
                <th className="px-6 py-4">Lokasi</th>
                <th className="px-6 py-4">Perwakilan</th>
                <th className="px-6 py-4">Siswa Terhubung</th>
                <th className="px-6 py-4">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schools.map((school) => {
                const schoolContacts = contacts.filter((contact) => contact.school_id === school.id);
                const schoolInterns = interns.filter((intern) => intern.school_id === school.id);
                const selectableInterns = interns.filter((intern) => !intern.school_id || intern.school_id === school.id);
                const canDelete = (school.contacts_count || 0) === 0 && (school.interns_count || 0) === 0;

                return (
                  <tr key={school.id} className="align-top hover:bg-slate-50/60">
                    <td className="px-6 py-4">
                      <form action={updateSchoolAction} className="grid gap-2">
                        <input type="hidden" name="schoolId" value={school.id} />
                        <TextInput name="name" defaultValue={school.name} placeholder="Nama instansi" required />
                        <TextInput name="type" defaultValue={school.type} placeholder="Tipe" />
                        <TextInput name="logoPath" defaultValue={school.logo_path} placeholder="Logo path / URL" />
                        <button className="w-fit rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100" type="submit">
                          Simpan Perubahan
                        </button>
                      </form>
                    </td>
                    <td className="px-6 py-4">
                      <form action={updateSchoolAction} className="grid gap-2">
                        <input type="hidden" name="schoolId" value={school.id} />
                        <input type="hidden" name="name" value={school.name} />
                        <input type="hidden" name="type" value={school.type || ""} />
                        <input type="hidden" name="logoPath" value={school.logo_path || ""} />
                        <TextInput name="city" defaultValue={school.city} placeholder="Kota" />
                        <TextInput name="province" defaultValue={school.province} placeholder="Provinsi" />
                        <TextInput name="address" defaultValue={school.address} placeholder="Alamat" />
                        <button className="w-fit rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100" type="submit">
                          Simpan Lokasi
                        </button>
                      </form>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {schoolContacts.length === 0 ? (
                        <span className="text-slate-400">Belum ada perwakilan</span>
                      ) : (
                        <div className="space-y-2">
                          {schoolContacts.map((contact) => (
                            <div key={contact.id} className="rounded-xl border border-slate-100 p-3">
                              <p className="font-bold text-slate-900">{contact.name}</p>
                              <p className="text-xs text-slate-500">{contact.email || "-"}</p>
                              <p className="text-xs text-slate-500">{contact.position || "Perwakilan Instansi"}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <Link href="/dashboard/super-admin/users" className="mt-3 block rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-center text-xs font-bold text-blue-800 hover:bg-blue-100">
                        Link User School
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <form action={linkInternToSchoolAction} className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <input type="hidden" name="schoolId" value={school.id} />
                        <label className="text-xs font-bold uppercase text-slate-500">Link Siswa ke Instansi Ini</label>
                        <SchoolInternSelector interns={selectableInterns} currentSchoolId={school.id} placeholder="Cari nama siswa..." />
                        <button type="submit" className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800">
                          Hubungkan Siswa
                        </button>
                      </form>

                      {schoolInterns.length === 0 ? (
                        <span className="text-slate-400">Belum ada siswa terhubung</span>
                      ) : (
                        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                          {schoolInterns.map((intern) => (
                            <div key={intern.id} className="rounded-xl border border-slate-100 p-3">
                              <p className="font-bold text-slate-900">{intern.full_name}</p>
                              <p className="text-xs text-slate-500">{intern.email || "-"}</p>
                              <p className="text-xs text-slate-500">{intern.major || "Jurusan belum diisi"} · {intern.status}</p>
                              <form action={linkInternToSchoolAction} className="mt-2">
                                <input type="hidden" name="internId" value={intern.id} />
                                <input type="hidden" name="schoolId" value="" />
                                <button type="submit" className="text-xs font-bold text-red-700 hover:text-red-800">
                                  Lepaskan dari instansi
                                </button>
                              </form>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                          <p><span className="font-bold text-slate-900">{school.contacts_count || 0}</span> perwakilan</p>
                          <p><span className="font-bold text-slate-900">{school.interns_count || 0}</span> siswa</p>
                        </div>
                        <form action={deleteSchoolAction}>
                          <input type="hidden" name="schoolId" value={school.id} />
                          <button
                            className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                            type="submit"
                            disabled={!canDelete}
                            title={canDelete ? "Hapus instansi" : "Lepaskan relasi perwakilan/siswa dahulu"}
                          >
                            Hapus
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {schools.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500">Belum ada instansi.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

