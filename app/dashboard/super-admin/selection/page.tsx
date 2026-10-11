import { requireSuperAdmin } from "@/features/auth/guards";
import { bypassSelectionAction } from "@/features/selection/actions";
import { getSelectionBypassOverview } from "@/features/selection/queries";

export default async function SuperAdminSelectionPage() {
  await requireSuperAdmin();
  const { applications, tests, bypasses } = await getSelectionBypassOverview();
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8"><header><p className="text-sm font-bold uppercase text-teal-700">Super Admin</p><h1 className="text-3xl font-bold">Bypass Seleksi</h1><p>Keputusan khusus tercatat dengan alasan wajib; bypass tidak memberi nilai dan tidak mengaktifkan peserta.</p></header>
    <form action={bypassSelectionAction} className="surface grid gap-4 p-6"><label>Pelamar<select name="applicationId" className="form-input w-full" required><option value="">Pilih pelamar</option>{applications.map((applicant) => <option key={applicant.id} value={applicant.id}>{applicant.full_name} · {applicant.email} · {applicant.selection_status ?? "belum seleksi"}</option>)}</select></label><label>Alasan wajib, minimal 20 karakter<textarea name="reason" className="form-input w-full" minLength={20} maxLength={3000} required /></label><button className="button-primary">Catat bypass</button></form>
    <section className="surface p-6"><h2 className="text-xl font-bold">Riwayat bypass</h2><ul className="space-y-3">{bypasses.map((bypass) => <li key={bypass.id} className="border-t pt-3"><strong>{applications.find((applicant) => applicant.id === bypass.application_id)?.full_name ?? bypass.application_id}</strong> · {bypass.bypassed_at}<p className="whitespace-pre-wrap">{bypass.reason}</p></li>)}</ul></section>
  </main>;
}
