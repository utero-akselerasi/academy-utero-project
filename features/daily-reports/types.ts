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
  /**
   * Sengaja `string | null`.
   *
   * Nilai yang keluar dari `queries.ts` sudah ditandatangani, dan
   * penandatanganan bisa gagal — objek yatim (baris ada, berkasnya tidak) normal
   * di data ini karena repo tidak punya satu pun `storage.remove()`. `null`
   * memaksa setiap titik render menangani "lampiran tidak bisa dibuka" secara
   * eksplisit, bukan merender `src=""`.
   *
   * Kecuali `mime_type === "url"`: baris itu tautan Google Drive dan dilewatkan
   * apa adanya, jadi selalu berisi string.
   */
  file_path: string | null;
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
