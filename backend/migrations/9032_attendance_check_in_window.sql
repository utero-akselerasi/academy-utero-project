ALTER TABLE utero_academy.attendance_settings
  ADD COLUMN IF NOT EXISTS check_in_end_time text NOT NULL DEFAULT '09:00';

ALTER TABLE utero_academy.attendance_settings
  ADD CONSTRAINT attendance_check_in_end_time_format
  CHECK (check_in_end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE utero_academy.attendances
  ADD COLUMN IF NOT EXISTS check_in_deadline_minutes integer;

UPDATE utero_academy.attendances attendance
SET check_in_deadline_minutes = CASE
  WHEN settings.check_in_time ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
    AND settings.late_tolerance_minutes BETWEEN 0 AND 180
  THEN floor(extract(epoch from settings.check_in_time::time) / 60)::integer + settings.late_tolerance_minutes
  ELSE 540
END
FROM utero_academy.attendance_settings settings
WHERE settings.id = '00000000-0000-0000-0000-000000000001'
  AND attendance.check_in_at IS NOT NULL
  AND attendance.check_in_deadline_minutes IS NULL;
