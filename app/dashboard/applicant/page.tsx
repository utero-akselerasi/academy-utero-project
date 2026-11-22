import { requireApplicant } from "@/features/auth/guards";
import { RegistrationForm } from "@/features/registration/RegistrationForm";
import { formatApplicationDate } from "@/features/admin/application-display";
import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { getLocalApplicantDashboard } from "@/features/registration/local-data";
import { usesLocalBackend } from "@/lib/backend/server";
import { AlertCircle, CalendarDays, Check, ClipboardList, UserRound, UsersRound } from "lucide-react";

const labels: Record<string, string> = { draft: "Draf", submitted: "Menunggu review", document_review: "Review dokumen", revision_requested: "Perlu revisi", selection: "Tahap seleksi", reviewed: "Sudah direview", accepted: "Diterima", rejected: "Tidak lolos", waitlisted: "Daftar tunggu", converted: "Menjadi peserta magang", cancelled: "Dibatalkan" };

export default async function ApplicantDashboardPage() {
  const user = await requireApplicant();
  let profile; let programs; let applications; let notifications;
  if (usesLocalBackend()) {
    ({ profile, programs, applications, notifications } = await getLocalApplicantDashboard());
  } else {
    const db = await createUteroAcademyServiceRoleClient();
    const results = await Promise.all([
      db.from("user_profiles").select("full_name").eq("id", user.id).maybeSingle(),
      db.from("programs").select("id,name").eq("status", "published").order("name"),
      db.from("internship_applications").select("id,full_name,status,selection_status,onboarding_status,school_name,major,proposed_start_date,proposed_end_date,approved_start_date,approved_end_date,created_at").eq("applicant_user_id", user.id).order("created_at", { ascending: false }),
      db.from("application_notifications").select("id,subject,payload,status,created_at").eq("recipient_user_id", user.id).order("created_at", { ascending: false }).limit(10),
    ]);
    profile = results[0].data; programs = results[1].data ?? []; applications = results[2].data ?? []; notifications = results[3].data ?? [];
  }
  const active = (applications ?? []).find((item) => !["rejected", "cancelled", "converted"].includes(item.status));
  return (
    <main className="applicant-dashboard min-h-full px-4 pb-10 pt-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="applicant-hero relative isolate overflow-hidden rounded-2xl px-5 py-7 sm:px-8 sm:py-9">
          <div className="relative z-10 flex items-start gap-4 sm:items-center sm:gap-6">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff505a] to-[#c20e22] text-white shadow-lg shadow-red-900/20 sm:h-20 sm:w-20">
              <UsersRound size={34} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="mb-2 inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-red-800">Portal Pelamar</p>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#101b3a] sm:text-4xl">Pendaftaran Magang</h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#344665] sm:text-base">Satu akun untuk pendaftaran, seleksi, daftar ulang, dan pemantauan status.</p>
            </div>
          </div>
        </header>

        {(applications ?? []).length > 0 && (
          <section aria-labelledby="registration-history" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_35px_rgba(16,27,58,0.06)] sm:p-6">
            <h2 id="registration-history" className="flex items-center gap-3 text-xl font-bold text-[#101b3a] sm:text-2xl">
              <span className="h-7 w-1.5 rounded-full bg-gradient-to-b from-[#ff4c57] to-[#bc0d21]" aria-hidden="true" />Riwayat Pendaftaran
            </h2>
            <div className="mt-5 space-y-3">
              {(applications ?? []).map((item) => (
                <article key={item.id} className="rounded-2xl border border-[#dce2ef] bg-[#fcfcff] p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-700 sm:h-16 sm:w-16" aria-hidden="true"><UserRound size={30} strokeWidth={1.7} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-bold text-[#101b3a]">{item.full_name}</h3>
                          <p className="mt-0.5 text-sm text-[#435674]">{[item.school_name, item.major].filter(Boolean).join(" · ") || "Informasi instansi belum tersedia"}</p>
                        </div>
                        <span className={"inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold " + (["reviewed", "accepted", "converted"].includes(item.status) ? "bg-emerald-100 text-emerald-800" : ["rejected", "cancelled"].includes(item.status) ? "bg-red-100 text-red-800" : "bg-blue-50 text-blue-800")}>
                          {["reviewed", "accepted", "converted"].includes(item.status) && <Check size={14} aria-hidden="true" />}{labels[item.status] ?? item.status}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-2 border-t border-slate-200 pt-3 text-sm text-[#263958]">
                        <p className="flex items-start gap-2"><ClipboardList size={16} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" /><span>Seleksi: <strong className="font-medium">{item.selection_status?.replaceAll("_", " ") ?? "Belum dimulai"}</strong><span className="mx-2 text-slate-400">·</span>Onboarding: <strong className="font-medium">{item.onboarding_status?.replaceAll("_", " ") ?? "Belum dimulai"}</strong></span></p>
                        <p className="flex items-start gap-2"><CalendarDays size={16} className="mt-0.5 shrink-0 text-[#566989]" aria-hidden="true" /><span>Periode: {formatApplicationDate(item.approved_start_date ?? item.proposed_start_date)} sampai {formatApplicationDate(item.approved_end_date ?? item.proposed_end_date)}</span></p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {active && (
              <div role="status" className="mt-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 text-amber-950 sm:px-5">
                <AlertCircle size={21} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                <div><p className="font-bold text-amber-800">Pendaftaran aktif sedang diproses.</p><p className="mt-1 text-sm">Form baru terbuka setelah pendaftaran selesai atau dibatalkan.</p></div>
              </div>
            )}
          </section>
        )}

        {(notifications ?? []).length > 0 && (
          <section aria-labelledby="applicant-notifications" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <h2 id="applicant-notifications" className="text-lg font-bold text-[#101b3a]">Notifikasi</h2>
            <ul className="mt-3 grid gap-2">{(notifications ?? []).map((item) => <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><strong className="text-[#101b3a]">{item.subject ?? "Pembaruan pendaftaran"}</strong><p className="mt-1 text-slate-600">{typeof item.payload === "object" && item.payload && "message" in item.payload ? String(item.payload.message) : "Buka status pendaftaran atau halaman seleksi untuk detail."}</p></li>)}</ul>
          </section>
        )}

        {!active && <section aria-labelledby="new-registration"><h2 id="new-registration" className="mb-3 text-xl font-bold text-[#101b3a]">Form pendaftaran</h2><RegistrationForm userId={user.id} email={user.email ?? ""} fullName={profile?.full_name ?? ""} programs={programs ?? []} /></section>}
      </div>
    </main>
  );
}
