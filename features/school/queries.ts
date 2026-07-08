import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import type {
  SchoolAttendance,
  SchoolDailyReport,
  SchoolDashboardStats,
  SchoolIntern,
  SchoolProfile,
  SchoolStudentDetail,
} from "./types";

function mapSchoolIntern(raw: any): SchoolIntern {
  const cert = Array.isArray(raw.certificates) ? raw.certificates[0] : raw.certificates;
  const assess = Array.isArray(raw.assessments) ? raw.assessments[0] : raw.assessments;

  return {
    id: raw.id,
    user_id: raw.user_id ?? null,
    full_name: raw.full_name,
    email: raw.email ?? null,
    phone: raw.phone ?? null,
    major: raw.major ?? null,
    grade_or_semester: raw.grade_or_semester ?? null,
    status: raw.status,
    start_date: raw.start_date ?? null,
    end_date: raw.end_date ?? null,
    certificate: cert
      ? {
          id: cert.id,
          certificate_number: cert.certificate_number ?? null,
          status: cert.status,
          file_path: cert.file_path ?? null,
        }
      : null,
    assessment: assess
      ? {
          id: assess.id,
          final_score: assess.final_score ?? null,
          feedback: assess.feedback ?? null,
          score: assess.score ?? null,
          status: assess.status,
        }
      : null,
  };
}

function mapAttendanceRows(rows: any[], internMap: Map<string, string>): SchoolAttendance[] {
  return (rows || []).map((row) => ({
    id: row.id,
    intern_id: row.intern_id,
    intern_name: internMap.get(row.intern_id) || "Peserta",
    attendance_date: row.attendance_date,
    check_in_at: row.check_in_at ?? null,
    check_out_at: row.check_out_at ?? null,
    status: row.status,
    review_note: row.review_note ?? null,
    attendance_type: row.attendance_type ?? null,
  }));
}

function mapDailyReportRows(rows: any[], internMap: Map<string, string>): SchoolDailyReport[] {
  return (rows || []).map((row) => ({
    id: row.id,
    intern_id: row.intern_id,
    intern_name: internMap.get(row.intern_id) || "Peserta",
    report_date: row.report_date,
    today_work: row.today_work,
    progress: row.progress ?? null,
    blockers: row.blockers ?? null,
    tomorrow_plan: row.tomorrow_plan ?? null,
    status: row.status,
    daily_report_attachments: row.daily_report_attachments || [],
  }));
}

function getAttendanceHours(attendance: Pick<SchoolAttendance, "check_in_at" | "check_out_at" | "attendance_type">) {
  if (attendance.attendance_type !== "present" || !attendance.check_in_at || !attendance.check_out_at) {
    return 0;
  }

  const diff = new Date(attendance.check_out_at).getTime() - new Date(attendance.check_in_at).getTime();
  return Math.max(0, diff / (1000 * 60 * 60));
}

export async function getSchoolProfile(userId: string): Promise<{ data: SchoolProfile | null; error: any }> {
  const db = await createUteroAcademyServiceRoleClient();

  const { data: contact, error } = await db
    .from("school_contacts")
    .select("school_id, schools(id, name, type, city, province, address, logo_path)")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !contact) {
    return { data: null, error };
  }

  const schoolObj = Array.isArray(contact.schools) ? contact.schools[0] : contact.schools;
  return { data: (schoolObj as SchoolProfile) ?? null, error: null };
}

export async function getSchoolInterns(schoolId: string): Promise<{ data: SchoolIntern[]; error: any }> {
  const db = await createUteroAcademyServiceRoleClient();

  const { data, error } = await db
    .from("intern_profiles")
    .select("id, user_id, full_name, email, phone, major, grade_or_semester, status, start_date, end_date, certificates(id, certificate_number, status, file_path), assessments(id, final_score, feedback, score, status)")
    .eq("school_id", schoolId)
    .order("full_name", { ascending: true })
    .returns<any[]>();

  return { data: (data || []).map(mapSchoolIntern), error };
}

export async function getSchoolInternsAttendances(schoolId: string): Promise<{ data: SchoolAttendance[]; error: any }> {
  const db = await createUteroAcademyServiceRoleClient();
  const { data: interns } = await getSchoolInterns(schoolId);

  if (interns.length === 0) return { data: [], error: null };

  const internMap = new Map(interns.map((intern) => [intern.id, intern.full_name]));
  const internIds = interns.map((intern) => intern.id);

  const { data, error } = await db
    .from("attendances")
    .select("id, intern_id, attendance_date, check_in_at, check_out_at, status, review_note, attendance_type")
    .in("intern_id", internIds)
    .order("attendance_date", { ascending: false });

  return { data: mapAttendanceRows(data || [], internMap), error };
}

export async function getSchoolInternsDailyReports(schoolId: string): Promise<{ data: SchoolDailyReport[]; error: any }> {
  const db = await createUteroAcademyServiceRoleClient();
  const { data: interns } = await getSchoolInterns(schoolId);

  if (interns.length === 0) return { data: [], error: null };

  const internMap = new Map(interns.map((intern) => [intern.id, intern.full_name]));
  const internIds = interns.map((intern) => intern.id);

  const { data, error } = await db
    .from("daily_reports")
    .select("id, intern_id, report_date, today_work, progress, blockers, tomorrow_plan, status, daily_report_attachments(id, file_path, file_name, mime_type)")
    .in("intern_id", internIds)
    .order("report_date", { ascending: false });

  return { data: mapDailyReportRows(data || [], internMap), error };
}

export async function getSchoolDashboardStats(schoolId: string): Promise<{ data: SchoolDashboardStats; error: any }> {
  const [{ data: interns }, { data: attendances }] = await Promise.all([
    getSchoolInterns(schoolId),
    getSchoolInternsAttendances(schoolId),
  ]);

  const totalInterns = interns.length;
  const activeInterns = interns.filter((intern) => intern.status === "active").length;
  const alumniInterns = interns.filter((intern) => intern.status === "completed" || intern.status === "inactive").length;

  const validAttendances = attendances.filter((attendance) => attendance.status === "valid" || attendance.status === "pending");
  const presentAttendances = validAttendances.filter((attendance) => attendance.attendance_type === "present");
  const avgAttendanceRate = validAttendances.length > 0 ? Math.round((presentAttendances.length / validAttendances.length) * 100) : 0;

  const scoredInterns = interns.filter((intern) => typeof intern.assessment?.final_score === "number");
  const avgFinalScore = scoredInterns.length > 0
    ? Number((scoredInterns.reduce((sum, intern) => sum + Number(intern.assessment?.final_score || 0), 0) / scoredInterns.length).toFixed(2))
    : null;

  const needAttentionCount = interns.filter((intern) => {
    const ownAttendances = attendances.filter((attendance) => attendance.intern_id === intern.id);
    if (ownAttendances.length === 0) return false;

    const ownPresent = ownAttendances.filter((attendance) => attendance.attendance_type === "present" && (attendance.status === "valid" || attendance.status === "pending"));
    const rate = Math.round((ownPresent.length / ownAttendances.length) * 100);
    return rate < 80;
  }).length;

  return {
    data: { totalInterns, activeInterns, alumniInterns, avgAttendanceRate, avgFinalScore, needAttentionCount },
    error: null,
  };
}

export async function getSchoolStudentDetail(schoolId: string, internId: string): Promise<{ data: SchoolStudentDetail | null; error: any }> {
  const [{ data: interns }, { data: attendances }, { data: reports }] = await Promise.all([
    getSchoolInterns(schoolId),
    getSchoolInternsAttendances(schoolId),
    getSchoolInternsDailyReports(schoolId),
  ]);

  const intern = interns.find((item) => item.id === internId);
  if (!intern) return { data: null, error: null };

  const ownAttendances = attendances.filter((attendance) => attendance.intern_id === internId);
  const ownReports = reports.filter((report) => report.intern_id === internId);
  const ownPresent = ownAttendances.filter((attendance) => attendance.attendance_type === "present" && (attendance.status === "valid" || attendance.status === "pending"));

  const attendanceRate = ownAttendances.length > 0 ? Math.round((ownPresent.length / ownAttendances.length) * 100) : 0;
  const totalHours = Number(ownAttendances.reduce((sum, attendance) => sum + getAttendanceHours(attendance), 0).toFixed(2));
  const lateCount = ownAttendances.filter((attendance) => attendance.status === "manual_review").length;
  const permitCount = ownAttendances.filter((attendance) => attendance.attendance_type === "permit").length;
  const sickCount = ownAttendances.filter((attendance) => attendance.attendance_type === "sick").length;

  return {
    data: {
      intern,
      attendances: ownAttendances,
      reports: ownReports,
      attendanceRate,
      totalHours,
      lateCount,
      permitCount,
      sickCount,
    },
    error: null,
  };
}
