import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteSchoolAction, linkInternToSchoolAction, updateSchoolAction } from "@/features/super-admin/actions";
import { getSuperAdminSchoolsData } from "@/features/super-admin/queries";
import { INTERNSHIP_STATUS_OPTIONS } from "@/features/super-admin/schemas";
import { requireSuperAdmin } from "@/features/auth/guards";
import { SchoolInternSelector } from "@/features/super-admin/components/SchoolInternSelector";
import { SchoolPartnershipForm } from "@/features/super-admin/components/SchoolPartnershipForm";
import { SchoolInternPeriodEditor } from "@/features/super-admin/components/SchoolInternPeriodEditor";

function Input({ name, value, placeholder, required = false }: { name: string; value?: string | null; placeholder: string; required?: boolean }) {
  return <label className="grid gap-1 text-xs font-semibold text-slate-600">{placeholder}<input name={name} defaultValue={value ?? ""} placeholder={placeholder} required={required} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100" /></label>;
}

function formatDate(value: string | null) {
  if (!value) return "Belum diatur";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

function inputDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

async function deleteSchoolFromDetail(formData: FormData) {
  "use server";
  await deleteSchoolAction(formData);
  redirect("/dashboard/super-admin/schools");
}

export default async function SuperAdminSchoolDetailPage({ params }: { params: Promise<{ schoolId: string }> }) {
  await requireSuperAdmin();
  const { schoolId } = await params;
  const { schools, contacts, interns } = await getSuperAdminSchoolsData();
  const school = schools.find((item) => item.id === schoolId);
  if (!school) notFound();

  const schoolContacts = contacts.filter((contact) => contact.school_id === school.id);
  const schoolInterns = interns.filter((intern) => intern.school_id === school.id);
  const selectableInterns = interns.filter((intern) => !intern.school_id || intern.school_id === school.id);
  const canDelete = schoolContacts.length === 0 && schoolInterns.length === 0;

  return (
    <main className="mx-auto w-full max-w-[1700px] space-y-4 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/super-admin/schools" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">&larr; Daftar instansi</Link>
        <Link href="/dashboard/super-admin/users" className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">Kelola akun pengguna</Link>
      </div>

      <header className="relative overflow-hidden rounded-2xl bg-slate-950 p-5 text-white shadow-lg sm:p-6">
        <div aria-hidden="true" className="absolute -right-12 -top-28 size-72 rounded-full border-[30px] border-white/5" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-red-300">Profil instansi <span className="mx-1 text-white/40">/</span> {school.partner_status.replaceAll("_", " ")}</p>
            <h1 className="mt-2 break-words text-2xl font-bold sm:text-3xl">{school.name}</h1>
            <p className="mt-1 text-sm text-slate-300">{[school.type, school.city, school.province].filter(Boolean).join(" · ") || "Lengkapi informasi instansi"}</p>
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:min-w-[440px]">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Perwakilan</dt><dd className="mt-0.5 text-lg font-bold tabular-nums">{schoolContacts.length}</dd></div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Peserta</dt><dd className="mt-0.5 text-lg font-bold tabular-nums">{schoolInterns.length}</dd></div>
            <div className="col-span-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 sm:col-span-1"><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Kode instansi</dt><dd className="mt-1 truncate text-sm font-semibold">{school.referral_code || "Belum dibuat"}</dd></div>
          </dl>
        </div>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
            <div><h2 className="text-sm font-bold text-slate-950">Informasi instansi</h2><p className="mt-0.5 text-xs text-slate-500">Identitas, alamat, dan pengaturan kemitraan.</p></div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase text-slate-600">{school.partner_status.replaceAll("_", " ")}</span>
          </div>
          <dl className="grid gap-x-6 gap-y-3 px-4 py-4 text-sm sm:grid-cols-2 sm:px-5">
            <div><dt className="text-xs text-slate-500">Jenis instansi</dt><dd className="mt-0.5 font-semibold text-slate-900">{school.type || "Belum diisi"}</dd></div>
            <div><dt className="text-xs text-slate-500">Lokasi</dt><dd className="mt-0.5 font-semibold text-slate-900">{[school.city, school.province].filter(Boolean).join(", ") || "Belum diisi"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Alamat</dt><dd className="mt-0.5 font-semibold text-slate-900">{school.address || "Belum diisi"}</dd></div>
          </dl>
          <details className="group border-t border-slate-200">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:px-5"><span>Edit profil dan kemitraan</span><span aria-hidden="true" className="text-slate-400 transition group-open:rotate-180">⌄</span></summary>
            <div className="grid gap-5 border-t border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2 sm:p-5">
              <form action={updateSchoolAction} className="grid content-start gap-2.5"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Profil</h3><input type="hidden" name="schoolId" value={school.id} /><Input name="name" value={school.name} placeholder="Nama instansi" required /><Input name="type" value={school.type} placeholder="Jenis instansi" /><Input name="city" value={school.city} placeholder="Kota" /><Input name="province" value={school.province} placeholder="Provinsi" /><Input name="address" value={school.address} placeholder="Alamat lengkap" /><Input name="logoPath" value={school.logo_path} placeholder="Logo path / URL" /><button className="mt-1 min-h-10 rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white transition hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700" type="submit">Simpan profil</button></form>
              <div className="border-t border-slate-200 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Kemitraan dan kode</h3><SchoolPartnershipForm school={school} /></div>
            </div>
          </details>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-950">Perwakilan instansi</h2><p className="mt-1 text-xs text-slate-500">Akun kontak yang terkait dengan portal sekolah.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-700">{schoolContacts.length}</span></div>
            <ul className="mt-3 divide-y divide-slate-100">{schoolContacts.map((contact) => <li key={contact.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3 first:pt-0"><div><p className="text-sm font-semibold text-slate-950">{contact.name}</p><p className="text-xs text-slate-500">{contact.position || "Perwakilan Instansi"}</p></div><div className="text-xs text-slate-600 sm:text-right"><p>{contact.email || "Email belum tersedia"}</p><p>{contact.phone || "Telepon belum tersedia"}</p></div></li>)}{schoolContacts.length === 0 ? <li className="py-3 text-sm text-slate-500">Belum ada perwakilan terhubung.</li> : null}</ul>
            <Link href="/dashboard/super-admin/users" className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">Hubungkan akun pengguna</Link>
          </section>
          <section className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 sm:p-5"><h2 className="text-sm font-bold text-slate-950">Zona berisiko</h2><p className="mt-1 text-xs leading-5 text-slate-600">Instansi hanya bisa dihapus jika tidak memiliki perwakilan dan peserta terhubung.</p>{!canDelete ? <p className="mt-2 text-xs font-semibold text-amber-800">Lepaskan relasi dahulu: {schoolContacts.length} perwakilan, {schoolInterns.length} peserta.</p> : <p className="mt-2 text-xs font-semibold text-slate-600">Tidak ada relasi aktif; instansi memenuhi syarat untuk dihapus.</p>}<form action={deleteSchoolFromDetail} className="mt-3"><input type="hidden" name="schoolId" value={school.id} /><button className="min-h-10 w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={!canDelete}>Hapus instansi</button></form></section>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div><h2 className="text-sm font-bold text-slate-950">Peserta terhubung</h2><p className="mt-1 text-xs text-slate-500">Hubungkan peserta baru atau perbarui status dan periode magang.</p></div>
          <span className="inline-flex w-fit rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold tabular-nums text-red-800">{schoolInterns.length} peserta</span>
        </div>
        <form action={linkInternToSchoolAction} className="grid gap-2 border-b border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:px-5"><input type="hidden" name="schoolId" value={school.id} /><SchoolInternSelector interns={selectableInterns} currentSchoolId={school.id} placeholder="Cari nama atau email peserta..." /><button type="submit" className="min-h-10 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-800">Hubungkan peserta</button></form>
        <div className="divide-y divide-slate-100">
          {schoolInterns.map((intern) => <article key={intern.id} className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(180px,0.8fr)_auto] lg:items-center">
            <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-slate-950">{intern.full_name}</h3><p className="mt-0.5 truncate text-xs text-slate-500">{intern.email || "Email belum tersedia"} · {intern.major || "Jurusan belum diisi"}</p><p className="mt-1 text-xs text-slate-500">{intern.grade_or_semester || "Kelas / semester belum diisi"}</p></div>
            <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">{intern.status}</span><span className="text-slate-600">{formatDate(intern.start_date)} – {formatDate(intern.end_date)}</span></div>
            <div className="flex flex-wrap gap-2 lg:justify-end"><SchoolInternPeriodEditor internId={intern.id} name={intern.full_name} startDate={inputDate(intern.start_date)} endDate={inputDate(intern.end_date)} major={intern.major} gradeOrSemester={intern.grade_or_semester} status={intern.status} statusOptions={INTERNSHIP_STATUS_OPTIONS} /><form action={linkInternToSchoolAction}><input type="hidden" name="internId" value={intern.id} /><input type="hidden" name="schoolId" value="" /><button type="submit" className="min-h-9 rounded-lg px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50">Lepaskan</button></form></div>
          </article>)}
          {schoolInterns.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">Belum ada peserta yang terhubung ke instansi ini.</p> : null}
        </div>
      </section>
    </main>
  );
}
