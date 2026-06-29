export type ReportStatus = "submitted" | "approved" | "revision_requested";

export type DailyReport = {
  id: string;
  intern_id: string;
  report_date: string;
  today_work: string;
  progress: string | null;
  blockers: string | null;
  tomorrow_plan: string | null;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
};

export type DailyReportAttachment = {
  id: string;
  report_id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export type DailyReportWithDetails = DailyReport & {
  daily_report_attachments: DailyReportAttachment[];
};

export type DailyReportWithIntern = DailyReportWithDetails & {
  intern_profiles: {
    id: string;
    user_id: string;
    user_profiles: {
      full_name: string;
    } | null;
  } | null;
};

export type DailyReportReview = {
  id: string;
  report_id: string;
  mentor_id: string;
  status: ReportStatus;
  note: string | null;
  created_at: string;
};
