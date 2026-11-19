create index if not exists idx_daily_report_attachments_report_id
  on utero_academy.daily_report_attachments(report_id);

create index if not exists idx_daily_reports_intern_status_date
  on utero_academy.daily_reports(intern_id, status, report_date desc);

create index if not exists idx_daily_reports_date_id
  on utero_academy.daily_reports(report_date desc, id desc);
