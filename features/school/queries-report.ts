import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";

export type SchoolReportMetrics = {
  school_id: string;
  school_name: string;
  period_start: string;
  period_end: string;
  total_students: number;
  active_students: number;
  avg_attendance_rate: number;
  avg_total_hours: number;
  avg_final_score: number | null;
  students: Array<{
    id: string;
    full_name: string;
    email: string | null;
    major: string | null;
    status: string;
    attendance_rate: number;
    total_hours: number;
    late_count: number;
    permit_count: number;
    sick_count: number;
    final_score: number | null;
  }>;
};

export async function getSchoolReportMetrics(
  schoolId: string,
  periodStart: string,
  periodEnd: string
): Promise<{ data: SchoolReportMetrics | null; error: any }> {
  const db = await createUteroAcademyServiceRoleClient();

  const { data: school, error: schoolError } = await db
    .from("schools")
    .select("id, name")
    .eq("id", schoolId)
    .maybeSingle();

  if (schoolError || !school) {
    return { data: null, error: schoolError };
  }

  const { data: interns, error: internsError } = await db
    .from("intern_profiles")
    .select("id, full_name, email, major, status")
    .eq("school_id", schoolId)
    .order("full_name", { ascending: true });

  if (internsError || !interns || interns.length === 0) {
    return { data: null, error: internsError };
  }

  const internIds = interns.map((i) => i.id);

  const { data: attendances } = await db
    .from("attendances")
    .select("intern_id, check_in_at, check_out_at, attendance_type, status")
    .in("intern_id", internIds)
    .gte("attendance_date", periodStart)
    .lte("attendance_date", periodEnd);

  const { data: assessments } = await db
    .from("assessments")
    .select("intern_id, final_score")
    .in("intern_id", internIds);

  const attendanceMap = new Map<string, { total: number; present: number; hours: number; late: number; permit: number; sick: number }>();
  (attendances || []).forEach((a) => {
    const entry = attendanceMap.get(a.intern_id) || { total: 0, present: 0, hours: 0, late: 0, permit: 0, sick: 0 };
    entry.total += 1;
    if (a.attendance_type === "present" && (a.status === "valid" || a.status === "pending")) {
      entry.present += 1;
      if (a.check_in_at && a.check_out_at) {
        const diffMs = new Date(a.check_out_at).getTime() - new Date(a.check_in_at).getTime();
        entry.hours += Math.max(0, diffMs / (1000 * 60 * 60));
      }
    }
    if (a.status === "manual_review") entry.late += 1;
    if (a.attendance_type === "permit") entry.permit += 1;
    if (a.attendance_type === "sick") entry.sick += 1;
    attendanceMap.set(a.intern_id, entry);
  });

  const assessmentMap = new Map<string, number | null>();
  (assessments || []).forEach((a) => {
    assessmentMap.set(a.intern_id, a.final_score ?? null);
  });

  const students = interns.map((intern) => {
    const att = attendanceMap.get(intern.id) || { total: 0, present: 0, hours: 0, late: 0, permit: 0, sick: 0 };
    const attendanceRate = att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;
    return {
      id: intern.id,
      full_name: intern.full_name,
      email: intern.email,
      major: intern.major,
      status: intern.status,
      attendance_rate: attendanceRate,
      total_hours: Number(att.hours.toFixed(2)),
      late_count: att.late,
      permit_count: att.permit,
      sick_count: att.sick,
      final_score: assessmentMap.get(intern.id) ?? null,
    };
  });

  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.status === "active").length;
  const avgAttendanceRate = totalStudents > 0 ? Math.round(students.reduce((sum, s) => sum + s.attendance_rate, 0) / totalStudents) : 0;
  const avgTotalHours = totalStudents > 0 ? Number((students.reduce((sum, s) => sum + s.total_hours, 0) / totalStudents).toFixed(2)) : 0;
  const scored = students.filter((s) => s.final_score !== null);
  const avgFinalScore = scored.length > 0 ? Number((scored.reduce((sum, s) => sum + (s.final_score || 0), 0) / scored.length).toFixed(2)) : null;

  return {
    data: {
      school_id: schoolId,
      school_name: school.name,
      period_start: periodStart,
      period_end: periodEnd,
      total_students: totalStudents,
      active_students: activeStudents,
      avg_attendance_rate: avgAttendanceRate,
      avg_total_hours: avgTotalHours,
      avg_final_score: avgFinalScore,
      students,
    },
    error: null,
  };
}
