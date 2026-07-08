export type SchoolProfile = {
  id: string;
  name: string;
  type: string | null;
  city: string | null;
  province: string | null;
  address: string | null;
  logo_path?: string | null;
};

export type SchoolIntern = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  major: string | null;
  grade_or_semester: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  certificate: {
    id: string;
    certificate_number: string | null;
    status: string;
    file_path?: string | null;
  } | null;
  assessment: {
    id: string;
    final_score: number | null;
    feedback: string | null;
    score: Record<string, unknown> | null;
    status: string;
  } | null;
};

export type SchoolAttendance = {
  id: string;
  intern_id: string;
  intern_name: string;
  attendance_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  status: string;
  review_note: string | null;
  attendance_type: string | null;
};

export type SchoolDailyReport = {
  id: string;
  intern_id: string;
  intern_name: string;
  report_date: string;
  today_work: string;
  progress: string | null;
  blockers: string | null;
  tomorrow_plan: string | null;
  status: string;
  daily_report_attachments?: Array<{
    id: string;
    file_path: string;
    file_name: string;
    mime_type: string | null;
  }>;
};

export type SchoolDashboardStats = {
  totalInterns: number;
  activeInterns: number;
  alumniInterns: number;
  avgAttendanceRate: number;
  avgFinalScore: number | null;
  needAttentionCount: number;
};

export type SchoolStudentDetail = {
  intern: SchoolIntern;
  attendances: SchoolAttendance[];
  reports: SchoolDailyReport[];
  attendanceRate: number;
  totalHours: number;
  lateCount: number;
  permitCount: number;
  sickCount: number;
};
