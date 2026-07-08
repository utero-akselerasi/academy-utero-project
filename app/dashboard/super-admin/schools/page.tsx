import Link from "next/link";
import {
  createSchoolAction,
  deleteSchoolAction,
  linkInternToSchoolAction,
  updateInternPeriodAction,
  updateSchoolAction,
} from "@/features/super-admin/actions";
import { getSuperAdminSchoolsData } from "@/features/super-admin/queries";
import { SchoolInternSelector } from "@/features/super-admin/components/SchoolInternSelector";

function TextInput({ name, defaultValue, placeholder, required = false }: { name: string; defaultValue?: string | null; placeholder: string; required?: boolean }) {
  return <input name={name} defaultValue={defaultValue || ""} placeholder={placeholder} required={required} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500" />;
}

function formatPeriod(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) return "Periode belum diatur";
  return `${startDate || "-"} s/d ${endDate || "-"}`;
}

export default async function SuperAdminSchoolsPage() {
  const { schools, contacts, interns, unassignedInterns, error } = await getSuperAdminSchoolsData();

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Super Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Manajemen Instansi</h1>
          <p className="mt-2 max-w-3xl leading-7 text-slate-600">Kelola sekolah/kampus partner, perwakilan, dan siswa yang terhubung ke School Portal.</p>
        </div>
        <div className="flex gap-2">
          <Link className="button-secondary" href="/dashboard/super-admin/users">User Management</Link>
          <Link className="button-secondary" href="/dashboard/super-admin">Kembali</Link>
        </div>
      </div>

      {error ? <div className="surface mb-4 p-4 text-sm font-semibold text-red-700">Data instansi belum bisa dibaca. Cek koneksi database atau policy tabel `schools`.</div> : null}

      <details className="surface mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5">
          <div>
            <h2 className="text-lg font-black text-slate-950">Tambah Instansi Baru</h2>
            <p className="mt-1 text-sm text-slate-500">Klik untuk membuka form tambah sekolah/kampus partner.</p>
          </div>
          <span className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white">+ Tambah Instansi</span>
        </summary>
        <form action={createSchoolAction} className="grid gap-3 border-t border-slate-100 px-6 pb-6 pt-4 md:grid-cols-2 lg:grid-cols-3">
          <TextInput name="name" placeholder="Nama instansi *" required />
          <TextInput name="type" placeholder="Tipe: SMK / Universitas / Kampus" />
          <TextInput name="city" placeholder="Kota" />
          <TextInput name="province" placeholder="Provinsi" />
          <div className="lg:col-span-2"><TextInput name="address" placeholder="Alamat lengkap" /></div>
          <div className="lg:col-span-2"><TextInput name="logoPath" placeholder="Logo path / URL logo (opsional)" /></div>
          <button className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800" type="submit">Simpan Instansi</button>
        </form>
      </details>

      <section className="surface mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <h2 className="text-base font-black text-amber-950">Siswa Belum Terhubung</h2>
        <p className="mt-1 text-sm text-amber-800">Ada {unassignedInterns.length} siswa yang belum punya instansi. Buka detail instansi lalu gunakan form Link Siswa.</p>
      </section>

      <section className="surface rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-black text-slate-950">Daftar Instansi</h2>
          <p className="text-sm text-slate-500">Total {schools.length} instansi terdaftar. Setiap instansi tampil satu baris; buka detail untuk edit data dan siswa.</p>
        </div>

        <div className="divide-y divide-slate-100">
          {schools.map((school) => {
            const schoolContacts = contacts.filter((contact) => contact.school_id === school.id);
            const schoolInterns = interns.filter((intern) => intern.school_id === school.id);
            const selectableInterns = interns.filter((intern) => !intern.school_id || intern.school_id === school.id);
            const canDelete = (school.contacts_count || 0) === 0 && (school.interns_count || 0) === 0;

            return (
              <details key={school.id} className="group">
                <summary className="grid cursor-pointer list-none items-center gap-4 px-6 py-4 hover:bg-slate-50 md:grid-cols-[1.4fr_1fr_1fr_auto]">
                  <div>
                    <h3 className="font-black text-slate-950">{school.name}</h3>
                    <p className="text-xs font-semibold text-slate-500">{school.type || "Tipe belum diisi"}</p>
                  </div>
                  <div className="text-sm text-slate-600">
                    <p>{school.city || "Kota belum diisi"}</p>
                    <p className="text-xs text-slate-400">{school.province || "Provinsi belum diisi"}</p>
                  </div>
                  <div className="flex gap-2 text-xs font-bold">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{school.contacts_count || 0} perwakilan</span>
                    <span className="rounded-full bg-teal-50 px-3 py-1 text-teal-700">{school.interns_count || 0} siswa</span>
                  </div>
                  <span className="rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-bold text-slate-700 group-open:bg-slate-900 group-open:text-white">Lihat Detail</span>
                </summary>

                <div className="grid gap-5 border-t border-slate-100 bg-slate-50/60 px-6 py-5 lg:grid-cols-[1fr_1fr_1.2fr]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h4 className="mb-3 text-sm font-black uppercase text-slate-500">Data Instansi</h4>
                    <form action={updateSchoolAction} className="grid gap-2">
                      <input type="hidden" name="schoolId" value={school.id} />
                      <TextInput name="name" defaultValue={school.name} placeholder="Nama instansi" required />
                      <TextInput name="type" defaultValue={school.type} placeholder="Tipe" />
                      <TextInput name="city" defaultValue={school.city} placeholder="Kota" />
                      <TextInput name="province" defaultValue={school.province} placeholder="Provinsi" />
                      <TextInput name="address" defaultValue={school.address} placeholder="Alamat" />
                      <TextInput name="logoPath" defaultValue={school.logo_path} placeholder="Logo path / URL" />
                      <button className="rounded-xl bg-teal-700 px-3 py-2 text-sm font-bold text-white hover:bg-teal-800" type="submit">Simpan Data Instansi</button>
                    </form>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <h4 className="text-sm font-black uppercase text-slate-500">Perwakilan</h4>
                      <div className="mt-3 space-y-2">
                        {schoolContacts.length === 0 ? <p className="text-sm text-slate-400">Belum ada perwakilan.</p> : schoolContacts.map((contact) => (
                          <div key={contact.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <p className="font-bold text-slate-900">{contact.name}</p>
                            <p className="text-xs text-slate-500">{contact.email || "-"}</p>
                            <p className="text-xs text-slate-500">{contact.position || "Perwakilan Instansi"}</p>
                          </div>
                        ))}
                      </div>
                      <Link href="/dashboard/super-admin/users" className="mt-3 block rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-center text-sm font-bold text-blue-800 hover:bg-blue-100">Link User School</Link>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <h4 className="text-sm font-black uppercase text-slate-500">Aksi</h4>
                      <form action={deleteSchoolAction} className="mt-3">
                        <input type="hidden" name="schoolId" value={school.id} />
                        <button className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-40" type="submit" disabled={!canDelete} title={canDelete ? "Hapus instansi" : "Lepaskan relasi perwakilan/siswa dahulu"}>Hapus Instansi</button>
                      </form>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h4 className="text-sm font-black uppercase text-slate-500">Siswa Terhubung</h4>
                    <form action={linkInternToSchoolAction} className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <input type="hidden" name="schoolId" value={school.id} />
                      <SchoolInternSelector interns={selectableInterns} currentSchoolId={school.id} placeholder="Cari nama siswa..." />
                      <button type="submit" className="rounded-xl bg-teal-700 px-3 py-2 text-sm font-bold text-white hover:bg-teal-800">Hubungkan Siswa</button>
                    </form>

                    <div className="mt-4 max-h-[30rem] space-y-3 overflow-y-auto pr-1">
                      {schoolInterns.length === 0 ? <p className="text-sm text-slate-400">Belum ada siswa terhubung.</p> : schoolInterns.map((intern) => (
                        <div key={intern.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-black text-slate-950">{intern.full_name}</p>
                              <p className="text-xs text-slate-500">{intern.email || "-"}</p>
                              <p className="mt-1 text-xs font-semibold text-slate-500">{intern.major || "Jurusan belum diisi"} · {intern.status}</p>
                              <p className="mt-1 text-xs text-slate-400">{formatPeriod(intern.start_date, intern.end_date)}</p>
                            </div>
                            <span className="rounded-full bg-teal-50 px-2 py-1 text-[10px] font-black uppercase text-teal-700">{intern.status}</span>
                          </div>

                          <details className="mt-3 rounded-xl bg-slate-50">
                            <summary className="cursor-pointer list-none px-3 py-2 text-xs font-black uppercase text-slate-600">Edit Masa Magang</summary>
                            <form action={updateInternPeriodAction} className="grid gap-2 px-3 pb-3">
                              <input type="hidden" name="internId" value={intern.id} />
                              <div className="grid grid-cols-2 gap-2">
                                <input type="date" name="startDate" defaultValue={intern.start_date || ""} className="rounded border border-slate-300 px-2 py-1 text-xs" />
                                <input type="date" name="endDate" defaultValue={intern.end_date || ""} className="rounded border border-slate-300 px-2 py-1 text-xs" />
                              </div>
                              <input name="major" defaultValue={intern.major || ""} placeholder="Jurusan" className="rounded border border-slate-300 px-2 py-1 text-xs" />
                              <input name="gradeOrSemester" defaultValue={intern.grade_or_semester || ""} placeholder="Kelas / Semester" className="rounded border border-slate-300 px-2 py-1 text-xs" />
                              <select name="status" defaultValue={intern.status} className="rounded border border-slate-300 px-2 py-1 text-xs">
                                <option value="active">Active</option>
                                <option value="completed">Completed</option>
                                <option value="inactive">Inactive</option>
                                <option value="pending">Pending</option>
                              </select>
                              <button type="submit" className="rounded bg-teal-700 px-2 py-1 text-xs font-bold text-white hover:bg-teal-800">Simpan Masa Magang</button>
                            </form>
                          </details>

                          <form action={linkInternToSchoolAction} className="mt-2">
                            <input type="hidden" name="internId" value={intern.id} />
                            <input type="hidden" name="schoolId" value="" />
                            <button type="submit" className="text-xs font-bold text-red-700 hover:text-red-800">Lepaskan dari instansi</button>
                          </form>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            );
          })}

          {schools.length === 0 ? <div className="px-6 py-10 text-center text-slate-500">Belum ada instansi.</div> : null}
        </div>
      </section>
    </main>
  );
}
