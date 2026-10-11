import { isInternBiodataComplete, type InternProfileData } from "@/features/auth/profile-schema";
import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";

function jakartaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

type ActivationApplication = {
  status: string;
  onboarding_status: string;
  converted_intern_id: string | null;
  approved_start_date: string | null;
  approved_end_date: string | null;
};

type ActivationProfile = {
  id: string;
  start_date: string | null;
  end_date: string | null;
};

export function hasApprovedOnboarding(application: ActivationApplication, profile: ActivationProfile) {
  return application.status === "accepted" &&
    application.converted_intern_id === profile.id &&
    ["waiting_start", "active"].includes(application.onboarding_status) &&
    Boolean(application.approved_start_date) &&
    application.approved_start_date === profile.start_date &&
    application.approved_end_date === profile.end_date;
}

export async function requireActiveInternProfile(userId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const [{ data: profile, error: profileError }, { data: userProfile, error: userError }, { data: application, error: applicationError }] = await Promise.all([
    db.from("intern_profiles").select("id,full_name,email,phone,major,grade_or_semester,school_name,address,school_supervisor_name,school_supervisor_phone,emergency_contact_name,emergency_contact_phone,start_date,end_date,status").eq("user_id", userId).maybeSingle(),
    db.from("user_profiles").select("full_name").eq("id", userId).maybeSingle(),
    db.from("internship_applications").select("id,status,onboarding_status,converted_intern_id,approved_start_date,approved_end_date").eq("applicant_user_id", userId).not("converted_intern_id", "is", null).order("converted_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (profileError || userError || applicationError) throw new Error("Gagal memverifikasi status peserta.");
  if (!profile) throw new Error("Profil peserta belum tersedia.");
  if (!isInternBiodataComplete(profile as InternProfileData, userProfile?.full_name ?? null, profile.email)) throw new Error("Lengkapi biodata sebelum menggunakan fitur magang.");
  if (application) {
    if (!hasApprovedOnboarding(application, profile)) {
      throw new Error("Daftar ulang belum disetujui admin.");
    }
  } else if (profile.status !== "active") {
    throw new Error("Status peserta belum disetujui admin.");
  }
  if (!profile.start_date || profile.start_date > jakartaToday()) throw new Error(`Fitur magang aktif mulai ${profile.start_date ?? "tanggal yang ditetapkan admin"}.`);
  if (profile.end_date && profile.end_date < jakartaToday()) throw new Error("Periode magang sudah selesai.");
  if (["paused", "completed", "failed", "alumni"].includes(profile.status)) throw new Error("Status peserta belum mengizinkan aktivitas magang.");
  if (application?.onboarding_status === "waiting_start") {
    const { data: activated, error } = await db.from("internship_applications").update({ onboarding_status: "active" })
      .eq("id", application.id).eq("onboarding_status", "waiting_start").select("id").maybeSingle();
    if (error || !activated) throw new Error("Gagal mengaktifkan status daftar ulang.");
  }
  if (application && profile.status !== "active") {
    const { data: activated, error } = await db.from("intern_profiles").update({ status: "active" })
      .eq("id", profile.id).eq("status", "pending").select("id").maybeSingle();
    if (error || !activated) throw new Error("Gagal mengaktifkan status peserta.");
  }
  return profile.id as string;
}
