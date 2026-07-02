import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { type DailyReport, type DailyReportWithDetails, type DailyReportReview, type DailyReportWithIntern } from "./types";

export async function getInternProfileId(userId: string): Promise<string | null> {
  const db = await createUteroAcademyServiceRoleClient();
  const { data } = await db
    .from("intern_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (data?.id) return data.id;

  const { data: userProfile } = await db
    .from("user_profiles")
    .select("full_name, phone")
    .eq("id", userId)
    .maybeSingle();

  if (!userProfile) return null;

  const { data: newProfile, error } = await db
    .from("intern_profiles")
    .insert({
      user_id: userId,
      full_name: userProfile.full_name,
      phone: userProfile.phone || null,
      status: "active"
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Gagal auto-provision intern profile:", error);
    return null;
  }
  return newProfile?.id ?? null;
}

export async function getMentorProfileId(userId: string): Promise<string | null> {
  const db = await createUteroAcademyServiceRoleClient();
  const { data } = await db
    .from("mentor_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (data?.id) return data.id;

  const { data: newProfile, error } = await db
    .from("mentor_profiles")
    .insert({ user_id: userId })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Gagal auto-provision mentor profile:", error);
    return null;
  }
  return newProfile?.id ?? null;
}

export async function getInternDailyReports(internProfileId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("daily_reports")
    .select("id, intern_id, report_date, today_work, progress, blockers, tomorrow_plan, status, created_at, updated_at, daily_report_attachments(id, report_id, file_path, file_name, mime_type, size_bytes, created_at)")
    .eq("intern_id", internProfileId)
    .order("report_date", { ascending: false })
    .returns<DailyReportWithDetails[]>();

  return { data: data ?? [], error };
}

export async function getMentorDailyReports(mentorProfileId: string) {
  const db = await createUteroAcademyServiceRoleClient();

  // Load all active interns globally (since penempatan bimbingan is global/deprecated)
  const { data: activeInterns } = await db
    .from("intern_profiles")
    .select("id")
    .eq("status", "active");

  const internIds = (activeInterns || []).map(i => i.id);

  if (internIds.length === 0) {
    return { data: [], error: null };
  }

  const { data: reports, error } = await db
    .from("daily_reports")
    .select("id, intern_id, report_date, today_work, progress, blockers, tomorrow_plan, status, created_at, updated_at, daily_report_attachments(id, report_id, file_path, file_name, mime_type, size_bytes, created_at), intern_profiles(id, user_id, full_name)")
    .in("intern_id", internIds)
    .order("report_date", { ascending: false })
    .returns<any[]>();

  if (error || !reports) {
    return { data: [], error };
  }

  const { data: userProfiles } = await db
    .from("user_profiles")
    .select("id, full_name");

  const profilesMap = new Map();
  if (userProfiles) {
    userProfiles.forEach((p) => profilesMap.set(p.id, p));
  }

  const mappedReports = reports.map((report) => {
    const ip = report.intern_profiles;
    const internProfileArray = Array.isArray(ip) ? ip[0] : ip;
    
    let userProfilesData = null;
    if (internProfileArray) {
      const uProfile = profilesMap.get(internProfileArray.user_id);
      userProfilesData = {
        full_name: uProfile?.full_name || internProfileArray.full_name || "Peserta"
      };
    }

    return {
      ...report,
      intern_profiles: internProfileArray ? {
        id: internProfileArray.id,
        user_id: internProfileArray.user_id,
        user_profiles: userProfilesData
      } : null
    };
  });

  return { data: mappedReports as DailyReportWithIntern[], error: null };
}

export async function getReportReviews(reportId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("daily_report_reviews")
    .select("id, report_id, mentor_id, status, note, created_at")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false })
    .returns<DailyReportReview[]>();

  return { data: data ?? [], error };
}
