import Link from "next/link";
import {
  createSchoolAction,
  deleteSchoolAction,
  linkInternToSchoolAction,
  updateInternPeriodAction,
  updateSchoolAction,
} from "@/features/super-admin/actions";
import { INTERNSHIP_STATUS_OPTIONS } from "@/features/super-admin/schemas";
import { getSuperAdminSchoolsData } from "@/features/super-admin/queries";
import { requireSuperAdmin } from "@/features/auth/guards";
import { SchoolInternSelector } from "@/features/super-admin/components/SchoolInternSelector";
import { SchoolPartnershipForm } from "@/features/super-admin/components/SchoolPartnershipForm";

function TextInput({ name, defaultValue, placeholder, required = false }: { name: string; defaultValue?: string | null; placeholder: string; required?: boolean }) {
  return <input name={name} defaultValue={defaultValue || ""} placeholder={placeholder} required={required} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500" />;
}

function formatPeriod(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) return "Periode belum diatur";
  return `${startDate || "-"} s/d ${endDate || "-"}`;
}

export default async function SuperAdminSchoolsPage() {
  await requireSuperAdmin();

  const { schools, contacts, interns, unassignedInterns, error } = await getSuperAdminSchoolsData();

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-5 sm:px-6">
      <header className="flex flex-col gap-3 rounded-2xl bg-slate-950 p-5 text-white shadow-lg md:flex-row md:items-end md:justify-between sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-300">Super Admin / data partner</p>
          <h1 className="mt-1 text-2xl font-bold">Manajemen instansi</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">Kelola sekolah, kampus, kontak perwakilan, dan peserta yang terhubung.</p>
        </div>
        <div className="flex gap-2">
          <Link className="rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10" href="/dashboard/super-admin/users">Kelola pengguna</Link>
          <Link className="rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10" href="/dashboard/super-admin">Kembali</Link>
        </div>
      </header>

      {error ? <div className="surface mb-4 p-4 text-sm font-semibold text-red-700">Data instansi belum bisa dibaca. Cek koneksi database atau policy tabel `schools`.</div> : null}

      <details className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-950">Tambah instansi</h2>
            <p className="mt-0.5 text-xs text-slate-600">Buka formulir untuk mendaftarkan sekolah atau kampus partner.</p>
          </div>
          <span className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white">+ Tambah Instansi</span>
        </summary>
        <form action={createSchoolAction} className="grid gap-3 border-t border-slate-200 bg-slate-50 p-4 md:grid-cols-2 lg:grid-cols-3">
          <TextInput name="name" placeholder="Nama instansi *" required />
          <TextInput name="type" placeholder="Tipe: SMK / Universitas / Kampus" />
          <TextInput name="city" placeholder="Kota" />
          <TextInput name="province" placeholder="Provinsi" />
          <div className="lg:col-span-2"><TextInput name="address" placeholder="Alamat lengkap" /></div>
          <div className="lg:col-span-2"><TextInput name="logoPath" placeholder="Logo path / URL logo (opsional)" /></div>
          <button className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800" type="submit">Simpan Instansi</button>
        </form>
      </details>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-base font-black text-amber-950">Siswa Belum Terhubung</h2>
        <p className="mt-1 text-sm text-amber-800">Ada {unassignedInterns.length} siswa yang belum punya instansi. Buka detail instansi lalu gunakan form Link Siswa.</p>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-950">Daftar instansi <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{schools.length}</span></h2>
          <p className="mt-0.5 text-xs text-slate-600">Pilih baris instansi untuk mengubah data, kontak, atau peserta.</p>
        </div>

        <div className="divide-y divide-slate-100">
          {schools.map((school) => {
            const schoolContacts = contacts.filter((contact) => contact.school_id === school.id);
            const schoolInterns = interns.filter((intern) => intern.school_id === school.id);
            const selectableInterns = interns.filter((intern) => !intern.school_id || intern.school_id === school.id);
            const canDelete = (school.contacts_count || 0) === 0 && (school.interns_count || 0) === 0;

            return (
              <details key={school.id} className="group">
                <summary className="grid cursor-pointer list-none items-center gap-2 px-4 py-3 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 sm:gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
                  <div>
                    <h3 className="text-sm font-bold text-slate-950">{school.name}</h3>
                    <p className="text-xs font-semibold text-slate-500">{school.type || "Tipe belum diisi"}</p>
                  </div>
                  <div className="text-sm text-slate-600">
                    <p>{school.city || "Kota belum diisi"}</p>
                    <p className="text-xs text-slate-400">{school.province || "Provinsi belum diisi"}</p>
                  </div>
                  <div className="flex gap-2 text-xs font-bold">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{school.contacts_count || 0} perwakilan</span>
                    <span className="rounded-full bg-red-50 px-2 py-1 text-red-800">{school.interns_count || 0} siswa</span>
                  </div>
                  <span className="rounded-lg border border-slate-300 px-3 py-2 text-center text-xs font-bold text-slate-700 group-open:bg-slate-900 group-open:text-white">Detail / edit</span>
                </summary>

                <div className="grid gap-3 border-t border-slate-200 bg-slate-50 p-3 lg:grid-cols-[1fr_1fr_1.2fr]">
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
                    <SchoolPartnershipForm school={school} />
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
                              {/* Opsinya diturunkan dari enum `internship_status`,
                                  tidak ditulis tangan. Daftar lama memuat
                                  `inactive` yang bukan anggota enum (memilihnya
                                  membatalkan seluruh simpan), dan menghilangkan
                                  `paused`/`failed`/`alumni` yang sah tapi tak
                                  terjangkau dari UI mana pun. */}
                              <select name="status" defaultValue={intern.status} className="rounded border border-slate-300 px-2 py-1 text-xs">
                                {INTERNSHIP_STATUS_OPTIONS.map((opsi) => (
                                  <option key={opsi.value} value={opsi.value}>{opsi.label}</option>
                                ))}
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
