CREATE SCHEMA IF NOT EXISTS utero_academy_archive;
REVOKE ALL ON SCHEMA utero_academy_archive FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE utero_academy.daily_report_reviews
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE utero_academy.daily_report_reviews reviews
SET reviewed_by = profiles.user_id
FROM utero_academy.mentor_profiles profiles
WHERE reviews.mentor_id = profiles.id
  AND reviews.reviewed_by IS NULL;

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM utero_academy.daily_report_reviews
    WHERE reviewed_by IS NULL AND mentor_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Atribusi review lama gagal dipetakan ke akun admin';
  END IF;
END
$do$;

ALTER TABLE utero_academy.daily_report_reviews
  DROP CONSTRAINT IF EXISTS daily_report_reviews_mentor_id_fkey;
ALTER TABLE utero_academy.daily_report_reviews
  RENAME COLUMN mentor_id TO legacy_mentor_profile_id;
ALTER TABLE utero_academy.daily_report_reviews
  ALTER COLUMN legacy_mentor_profile_id DROP NOT NULL;

ALTER TABLE utero_academy.assessments
  DROP CONSTRAINT IF EXISTS assessments_mentor_id_fkey;
ALTER TABLE utero_academy.assessments
  RENAME COLUMN mentor_id TO legacy_mentor_profile_id;

ALTER TABLE utero_academy.classes
  DROP CONSTRAINT IF EXISTS classes_mentor_id_fkey;
ALTER TABLE utero_academy.classes
  RENAME COLUMN mentor_id TO legacy_mentor_profile_id;

ALTER TABLE utero_academy.task_cards
  DROP CONSTRAINT IF EXISTS task_cards_mentor_id_fkey;
DROP INDEX IF EXISTS utero_academy.idx_task_cards_mentor_id;
ALTER TABLE utero_academy.task_cards
  RENAME COLUMN mentor_id TO legacy_mentor_profile_id;

ALTER TABLE utero_academy.mentor_profiles SET SCHEMA utero_academy_archive;
ALTER TABLE utero_academy.mentor_assignments SET SCHEMA utero_academy_archive;

ALTER TABLE utero_academy_archive.mentor_profiles
  DROP CONSTRAINT IF EXISTS mentor_profiles_user_id_fkey;
ALTER TABLE utero_academy_archive.mentor_assignments
  DROP CONSTRAINT IF EXISTS mentor_assignments_intern_id_fkey;
ALTER TABLE utero_academy_archive.mentor_assignments
  DROP CONSTRAINT IF EXISTS mentor_assignments_assigned_by_fkey;

REVOKE ALL ON ALL TABLES IN SCHEMA utero_academy_archive FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA utero_academy_archive FROM PUBLIC, anon, authenticated, service_role;