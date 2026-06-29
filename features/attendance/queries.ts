import { createUteroAcademyClient } from "@/lib/supabase/server";
import { type Attendance, type AttendanceWithIntern } from "./types";

export async function getInternAttendances(internProfileId: string) {
  const db = await createUteroAcademyClient();
  const { data, error } = await db
    .from("attendances")
    .select("id, intern_id, attendance_date, check_in_at, check_in_latitude, check_in_longitude, check_in_selfie_path, check_in_wifi_ssid, check_out_at, check_out_latitude, check_out_longitude, check_out_selfie_path, check_out_wifi_ssid, status, review_note, reviewed_by, reviewed_at, created_at, updated_at")
    .eq("intern_id", internProfileId)
    .order("attendance_date", { ascending: false })
    .returns<Attendance[]>();

  return { data: data ?? [], error };
}

export async function getTodayAttendance(internProfileId: string) {
  const db = await createUteroAcademyClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db
    .from("attendances")
    .select("id, intern_id, attendance_date, check_in_at, check_in_latitude, check_in_longitude, check_in_selfie_path, check_in_wifi_ssid, check_out_at, check_out_latitude, check_out_longitude, check_out_selfie_path, check_out_wifi_ssid, status, review_note, reviewed_by, reviewed_at, created_at, updated_at")
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
    .select("id, intern_id, attendance_date, check_in_at, check_in_latitude, check_in_longitude, check_in_selfie_path, check_in_wifi_ssid, check_out_at, check_out_latitude, check_out_longitude, check_out_selfie_path, check_out_wifi_ssid, status, review_note, reviewed_by, reviewed_at, created_at, updated_at, intern_profiles(id, full_name)")
    .in("intern_id", internIds)
    .order("attendance_date", { ascending: false })
    .returns<AttendanceWithIntern[]>();

  return { data: data ?? [], error };
}
