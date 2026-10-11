import { requireApplicant } from "@/features/auth/guards";
import { RegistrationForm } from "@/features/registration/RegistrationForm";
import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";

const labels: Record<string, string> = { draft: "Draf", submitted: "Menunggu review", document_review: "Review dokumen", revision_requested: "Perlu revisi", selection: "Tahap seleksi", reviewed: "Sudah direview", accepted: "Diterima", rejected: "Tidak lolos", waitlisted: "Daftar tunggu", converted: "Menjadi peserta magang", cancelled: "Dibatalkan" };

export default async function ApplicantDashboardPage() {
  const user = await requireApplicant();
  const db = await createUteroAcademyServiceRoleClient();
  const [{ data: profile }, { data: programs }, { data: applications }, { data: notifications }] = await Promise.all([
    db.from("user_profiles").select("full_name").eq("id", user.id).maybeSingle(),
    db.from("programs").select("id,name").eq("status", "published").order("name"),
    db.from("internship_applications").select("id,full_name,status,selection_status,onboarding_status,school_name,major,proposed_start_date,proposed_end_date,approved_start_date,approved_end_date,created_at").eq("applicant_user_id", user.id).order("created_at", { ascending: false }),
    db.from("application_notifications").select("id,subject,payload,status,created_at").eq("recipient_user_id", user.id).order("created_at", { ascending: false }).limit(10),
  ]);
  const active = (applications ?? []).find((item) => !["rejected", "cancelled", "converted"].includes(item.status));
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <header><p className="text-sm font-bold uppercase text-teal-700">Portal Pelamar</p><h1 className="text-3xl font-bold">Pendaftaran Magang</h1><p className="text-slate-600">Satu akun untuk pendaftaran, seleksi, daftar ulang, dan pemantauan status.</p></header>
    {(notifications ?? []).length ? <section className="surface p-6"><h2 className="text-xl font-bold">Notifikasi</h2><ul className="mt-3 grid gap-2">{(notifications ?? []).map((item) => <li className="rounded-lg border p-3" key={item.id}><strong>{item.subject ?? "Pembaruan pendaftaran"}</strong><p className="text-sm text-slate-600">{typeof item.payload === "object" && item.payload && "message" in item.payload ? String(item.payload.message) : "Buka status pendaftaran atau halaman seleksi untuk detail."}</p></li>)}</ul></section> : null}
    {(applications ?? []).length ? <section className="surface p-6"><h2 className="text-xl font-bold">Riwayat pendaftaran</h2><div className="mt-4 grid gap-3">{(applications ?? []).map((item) => <article key={item.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.full_name}</strong><span className="badge">{labels[item.status] ?? item.status}</span></div><p className="text-sm text-slate-600">{item.school_name} · {item.major}</p><p className="mt-2 text-sm">Seleksi: {item.selection_status} · Onboarding: {item.onboarding_status}</p><p className="text-sm">Periode: {item.approved_start_date ?? item.proposed_start_date ?? "-"} sampai {item.approved_end_date ?? item.proposed_end_date ?? "-"}</p></article>)}</div></section> : null}
    {!active ? <section><h2 className="mb-3 text-xl font-bold">Form pendaftaran</h2><RegistrationForm email={user.email ?? ""} fullName={profile?.full_name ?? ""} programs={programs ?? []} /></section> : <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">Pendaftaran aktif sedang diproses. Form baru terbuka setelah pendaftaran selesai atau dibatalkan.</p>}
  </main>;
}
