import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteSchoolAction, linkInternToSchoolAction, updateInternPeriodAction, updateSchoolAction } from "@/features/super-admin/actions";
import { INTERNSHIP_STATUS_OPTIONS } from "@/features/super-admin/schemas";
import { getSuperAdminSchoolsData } from "@/features/super-admin/queries";
import { requireSuperAdmin } from "@/features/auth/guards";
import { SchoolInternSelector } from "@/features/super-admin/components/SchoolInternSelector";
import { SchoolPartnershipForm } from "@/features/super-admin/components/SchoolPartnershipForm";

function Input({ name, value, placeholder, required = false }: { name: string; value?: string | null; placeholder: string; required?: boolean }) {
  return <input name={name} defaultValue={value ?? ""} placeholder={placeholder} required={required} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-600" />;
}

function formatDate(value: string | null) {
  if (!value) return "-";
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
      <Link href="/dashboard/super-admin/schools" className="inline-flex min-h-10 items-center text-sm font-semibold text-slate-600 hover:text-red-700">&larr; Kembali ke daftar instansi</Link>
      <header className="flex flex-col gap-4 rounded-2xl bg-slate-950 p-5 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.16em] text-red-300">Profil instansi / {school.partner_status.replaceAll("_", " ")}</p><h1 className="mt-1 truncate text-2xl font-bold">{school.name}</h1><p className="mt-1 text-sm text-slate-300">{[school.type, school.city, school.province].filter(Boolean).join(" / ") || "Informasi instansi"}</p></div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-white/10 px-3 py-2">{schoolContacts.length} perwakilan</span><span className="rounded-full bg-white/10 px-3 py-2">{schoolInterns.length} peserta</span><Link href="/dashboard/super-admin/users" className="rounded-lg border border-white/30 px-3 py-2 hover:bg-white/10">Kelola pengguna</Link></div>
      </header>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(280px,0.85fr)_minmax(300px,0.9fr)_minmax(360px,1.25fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-950">Data instansi</h2><p className="mt-1 text-xs text-slate-500">Ubah identitas dan informasi kontak.</p>
          <form action={updateSchoolAction} className="mt-4 grid gap-2"><input type="hidden" name="schoolId" value={school.id} /><Input name="name" value={school.name} placeholder="Nama instansi" required /><Input name="type" value={school.type} placeholder="Tipe instansi" /><Input name="city" value={school.city} placeholder="Kota" /><Input name="province" value={school.province} placeholder="Provinsi" /><Input name="address" value={school.address} placeholder="Alamat lengkap" /><Input name="logoPath" value={school.logo_path} placeholder="Logo path / URL" /><button className="rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white hover:bg-red-800" type="submit">Simpan perubahan</button></form>
          <SchoolPartnershipForm school={school} />
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><div><h2 className="text-sm font-bold text-slate-950">Perwakilan instansi</h2><p className="mt-1 text-xs text-slate-500">Kontak yang terhubung dengan portal sekolah.</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{schoolContacts.length}</span></div>
            <ul className="mt-3 divide-y divide-slate-100">{schoolContacts.map((contact) => <li key={contact.id} className="py-3 first:pt-0"><p className="text-sm font-semibold text-slate-900">{contact.name}</p><p className="text-xs text-slate-500">{contact.position || "Perwakilan Instansi"} / {contact.email || "Email belum tersedia"}</p></li>)}{schoolContacts.length === 0 ? <li className="py-3 text-sm text-slate-500">Belum ada perwakilan terkait.</li> : null}</ul>
            <Link href="/dashboard/super-admin/users" className="mt-3 block rounded-lg border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50">Hubungkan akun pengguna</Link>
          </section>
          <section className="rounded-xl border border-red-200 bg-white p-4 shadow-sm"><h2 className="text-sm font-bold text-slate-950">Zona berisiko</h2><p className="mt-1 text-xs leading-5 text-slate-600">Instansi hanya dapat dihapus jika belum punya perwakilan atau peserta terhubung.</p>{!canDelete ? <p className="mt-2 text-xs font-semibold text-amber-800">Lepaskan relasi dahulu ({schoolContacts.length} perwakilan, {schoolInterns.length} peserta).</p> : null}<form action={deleteSchoolFromDetail} className="mt-3"><input type="hidden" name="schoolId" value={school.id} /><button className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={!canDelete}>Hapus instansi</button></form></section>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><div><h2 className="text-sm font-bold text-slate-950">Peserta terhubung</h2><p className="mt-1 text-xs text-slate-500">Atur periode dan status peserta.</p></div><span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-800">{schoolInterns.length}</span></div>
          <form action={linkInternToSchoolAction} className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3"><input type="hidden" name="schoolId" value={school.id} /><SchoolInternSelector interns={selectableInterns} currentSchoolId={school.id} placeholder="Cari peserta untuk dihubungkan..." /><button type="submit" className="rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white hover:bg-red-800">Hubungkan peserta</button></form>
          <ul className="mt-3 divide-y divide-slate-100">{schoolInterns.map((intern) => <li key={intern.id} className="py-3 first:pt-0"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-950">{intern.full_name}</p><p className="text-xs text-slate-500">{intern.email || "Email belum tersedia"} / {intern.major || "Jurusan belum diisi"}</p><p className="mt-1 text-xs text-slate-500">{formatDate(intern.start_date)} - {formatDate(intern.end_date)} / {intern.status}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">{intern.grade_or_semester || "Peserta"}</span></div>
            <details className="mt-2 rounded-lg bg-slate-50"><summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">Ubah periode dan status</summary><form action={updateInternPeriodAction} className="grid gap-2 px-3 pb-3"><input type="hidden" name="internId" value={intern.id} /><div className="grid grid-cols-2 gap-2"><label className="text-[11px] text-slate-600">Mulai<input type="date" name="startDate" defaultValue={inputDate(intern.start_date)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs" /></label><label className="text-[11px] text-slate-600">Selesai<input type="date" name="endDate" defaultValue={inputDate(intern.end_date)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs" /></label></div><Input name="major" value={intern.major} placeholder="Jurusan" /><Input name="gradeOrSemester" value={intern.grade_or_semester} placeholder="Kelas / Semester" /><select name="status" defaultValue={intern.status} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">{INTERNSHIP_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Simpan data peserta</button></form></details>
            <form action={linkInternToSchoolAction} className="mt-2"><input type="hidden" name="internId" value={intern.id} /><input type="hidden" name="schoolId" value="" /><button type="submit" className="text-xs font-semibold text-red-700 hover:text-red-900">Lepaskan dari instansi</button></form>
          </li>)}{schoolInterns.length === 0 ? <li className="py-4 text-sm text-slate-500">Belum ada peserta terhubung.</li> : null}</ul>
        </section>
      </div>
    </main>
  );
}
