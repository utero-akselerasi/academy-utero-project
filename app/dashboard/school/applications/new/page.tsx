import Link from "next/link";
import { CreateApplicationForm, BulkImportForm } from "@/features/school-applications/components/ApplicationForms";
import { requireActiveSchoolPartner } from "@/features/school-applications/queries";

export const dynamic = "force-dynamic";

export default async function NewSchoolApplicationPage() {
  const { school } = await requireActiveSchoolPartner();
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link className="text-sm font-bold text-blue-700" href="/dashboard/school/applications">← Kembali ke pendaftaran</Link>
      <div className="mt-5"><p className="text-sm font-bold uppercase tracking-widest text-blue-700">{school.name}</p><h1 className="mt-2 text-3xl font-black text-slate-950">Daftarkan calon peserta</h1><p className="mt-2 text-slate-600">Semua peserta tetap mengikuti review dokumen dan proses seleksi Utero Academy.</p></div>
      <div className="mt-7 grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-slate-900">Satu peserta</h2><div className="mt-5"><CreateApplicationForm /></div></section><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-slate-900">Import banyak peserta</h2><div className="mt-5"><BulkImportForm /></div></section></div>
    </main>
  );
}
