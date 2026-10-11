import { isInternBiodataComplete, type InternProfileData } from "@/features/auth/profile-schema";
import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";

function jakartaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function requireActiveInternProfile(userId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const [{ data: profile }, { data: userProfile }, { data: application }] = await Promise.all([
    db.from("intern_profiles").select("id,full_name,email,phone,major,grade_or_semester,school_name,address,school_supervisor_name,school_supervisor_phone,emergency_contact_name,emergency_contact_phone,start_date,end_date,status").eq("user_id", userId).maybeSingle(),
    db.from("user_profiles").select("full_name").eq("id", userId).maybeSingle(),
    db.from("internship_applications").select("id,onboarding_status").eq("applicant_user_id", userId).not("converted_intern_id", "is", null).order("converted_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!profile) throw new Error("Profil peserta belum tersedia.");
  if (!isInternBiodataComplete(profile as InternProfileData, userProfile?.full_name ?? null, profile.email)) throw new Error("Lengkapi biodata sebelum menggunakan fitur magang.");
  if (!application) return profile.id as string;
  if (!profile.start_date || profile.start_date > jakartaToday()) throw new Error(`Fitur magang aktif mulai ${profile.start_date ?? "tanggal yang ditetapkan admin"}.`);
  if (profile.end_date && profile.end_date < jakartaToday()) throw new Error("Periode magang sudah selesai.");
  if (["paused", "completed", "failed", "alumni"].includes(profile.status)) throw new Error("Status peserta belum mengizinkan aktivitas magang.");
  if (profile.status !== "active") await db.from("intern_profiles").update({ status: "active" }).eq("id", profile.id);
  if (application && application.onboarding_status !== "active") await db.from("internship_applications").update({ onboarding_status: "active" }).eq("id", application.id);
  return profile.id as string;
}
