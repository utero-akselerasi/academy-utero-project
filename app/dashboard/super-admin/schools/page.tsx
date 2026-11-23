import Link from "next/link";
import { createSchoolAction } from "@/features/super-admin/actions";
import { getSuperAdminSchoolsData } from "@/features/super-admin/queries";
import { requireSuperAdmin } from "@/features/auth/guards";

function TextInput({ name, placeholder, required = false }: { name: string; placeholder: string; required?: boolean }) {
  return <input name={name} placeholder={placeholder} required={required} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-600" />;
}

export default async function SuperAdminSchoolsPage() {
  await requireSuperAdmin();
  const { schools, unassignedInterns, error } = await getSuperAdminSchoolsData();

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-5 sm:px-6">
      <header className="flex flex-col gap-3 rounded-2xl bg-slate-950 p-5 text-white shadow-lg sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-300">Super Admin / data partner</p>
          <h1 className="mt-1 text-2xl font-bold">Manajemen instansi</h1>
          <p className="mt-1 text-sm text-slate-300">Buka profil instansi untuk mengelola data, perwakilan, dan peserta.</p>
        </div>
        <Link className="rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold hover:bg-white/10" href="/dashboard/super-admin">Kembali</Link>
      </header>

      {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Data instansi belum dapat dimuat. Coba lagi nanti.</p> : null}

      <details className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:outline-red-700">
          <span className="text-sm font-bold text-slate-950">Tambah instansi baru</span>
          <span className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white">+ Tambah instansi</span>
        </summary>
        <form action={createSchoolAction} className="grid gap-3 border-t border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextInput name="name" placeholder="Nama instansi *" required />
          <TextInput name="type" placeholder="Tipe: SMK / Universitas / Kampus" />
          <TextInput name="city" placeholder="Kota" />
          <TextInput name="province" placeholder="Provinsi" />
          <div className="lg:col-span-2"><TextInput name="address" placeholder="Alamat lengkap" /></div>
          <div className="lg:col-span-2"><TextInput name="logoPath" placeholder="Logo path / URL logo (opsional)" /></div>
          <button className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800" type="submit">Simpan instansi</button>
        </form>
      </details>

      {unassignedInterns.length > 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>{unassignedInterns.length} peserta belum terhubung.</strong> Buka profil instansi untuk menghubungkan peserta.
        </p>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-950">Daftar instansi <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{schools.length}</span></h2>
          <p className="text-xs text-slate-500">Pilih instansi untuk melihat dan mengubah detail.</p>
        </div>
        <ul className="divide-y divide-slate-100">
          {schools.map((school) => (
            <li key={school.id}>
              <Link href={`/dashboard/super-admin/schools/${school.id}`} className="grid items-center gap-2 px-4 py-3 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-red-700 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] sm:gap-4">
                <span className="min-w-0"><strong className="block truncate text-sm text-slate-950">{school.name}</strong><span className="text-xs text-slate-500">{school.type || "Tipe belum diisi"}</span></span>
                <span className="text-xs text-slate-600">{[school.city, school.province].filter(Boolean).join(", ") || "Lokasi belum diisi"}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
                  <span className="rounded-full bg-slate-100 px-2 py-1">{school.contacts_count || 0} perwakilan</span>
                  <span className="rounded-full bg-red-50 px-2 py-1 text-red-800">{school.interns_count || 0} peserta</span>
                  <span className="ml-auto text-red-700 sm:ml-2">Lihat detail →</span>
                </span>
              </Link>
            </li>
          ))}
          {!error && schools.length === 0 ? <li className="px-4 py-10 text-center text-sm text-slate-500">Belum ada instansi.</li> : null}
        </ul>
      </section>
    </main>
  );
}
