import { createUteroAcademyClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { type Attendance, type AttendanceWithIntern } from "./types";

export async function getInternAttendances(internProfileId: string) {
  const db = await createUteroAcademyClient();
  const { data, error } = await db
    .from("attendances")
    .select("*")
    .eq("intern_id", internProfileId)
    .order("attendance_date", { ascending: false })
    .returns<Attendance[]>();

  return { data: data ?? [], error };
}

export async function getTodayAttendance(internProfileId: string) {
  const db = await createUteroAcademyClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const { data } = await db
    .from("attendances")
    .select("*")
    .eq("intern_id", internProfileId)
    .eq("attendance_date", today)
    .maybeSingle();

  return data as Attendance | null;
}

export async function getMentorAttendances(mentorProfileId: string) {
  const db = await createUteroAcademyClient();

  const { data: assignments } = await db
    .from("mentor_assignments")
    .select("intern_id")
    .eq("mentor_id", mentorProfileId);

  if (!assignments || assignments.length === 0) {
    return { data: [], error: null };
  }

  const internIds = assignments.map((a) => a.intern_id);

  const { data, error } = await db
    .from("attendances")
    .select("*, intern_profiles(id, full_name)")
    .in("intern_id", internIds)
    .order("attendance_date", { ascending: false })
    .returns<AttendanceWithIntern[]>();

  return { data: data ?? [], error };
}

export async function getAllAttendances() {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("attendances")
    .select("*, intern_profiles(id, full_name)")
    .order("attendance_date", { ascending: false })
    .returns<any[]>();

  const mapped = (data || []).map(d => {
    const ip = Array.isArray(d.intern_profiles) ? d.intern_profiles[0] : d.intern_profiles;
    return {
      ...d,
      intern_profiles: ip ? {
        id: ip.id,
        full_name: ip.full_name
      } : null
    };
  });

  return { data: mapped as AttendanceWithIntern[], error };
}
