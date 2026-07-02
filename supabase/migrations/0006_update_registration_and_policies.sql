-- Migration 0006: Update registration schema, add attendance settings and fix RLS policies for admin role

-- 1. Tambah kolom ke internship_applications
ALTER TABLE utero_academy.internship_applications 
ADD COLUMN IF NOT EXISTS cv_path text,
ADD COLUMN IF NOT EXISTS portfolio_path text;

-- 2. Tambah kolom ke attendances
ALTER TABLE utero_academy.attendances 
ADD COLUMN IF NOT EXISTS attendance_type text NOT NULL DEFAULT 'present',
ADD COLUMN IF NOT EXISTS permit_reason text,
ADD COLUMN IF NOT EXISTS sick_certificate_path text;

-- 3. Buat tabel attendance_settings
CREATE TABLE IF NOT EXISTS utero_academy.attendance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_in_time text NOT NULL DEFAULT '08:00',
  check_out_time text NOT NULL DEFAULT '17:00',
  late_tolerance_minutes integer NOT NULL DEFAULT 15,
  monthly_target_hours integer NOT NULL DEFAULT 120,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default settings jika belum ada
INSERT INTO utero_academy.attendance_settings (id, check_in_time, check_out_time, late_tolerance_minutes, monthly_target_hours)
VALUES ('00000000-0000-0000-0000-000000000001', '08:00', '17:00', 15, 120)
ON CONFLICT (id) DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE utero_academy.attendance_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE utero_academy.attendance_settings TO anon;

-- 4. RLS Policies update untuk pendaftaran (internship_applications) menggunakan role 'admin'
DROP POLICY IF EXISTS "admin dapat membaca semua pendaftaran" ON utero_academy.internship_applications;
CREATE POLICY "admin dapat membaca semua pendaftaran"
ON utero_academy.internship_applications
FOR SELECT
TO authenticated
USING (
  utero_academy.current_user_has_role('admin')
);

DROP POLICY IF EXISTS "admin dapat update status pendaftaran" ON utero_academy.internship_applications;
CREATE POLICY "admin dapat update status pendaftaran"
ON utero_academy.internship_applications
FOR UPDATE
TO authenticated
USING (
  utero_academy.current_user_has_role('admin')
)
WITH CHECK (
  utero_academy.current_user_has_role('admin')
);

-- 5. RLS Policies update untuk user_roles & user_profiles
DROP POLICY IF EXISTS "super_admin dapat membaca user_roles" ON utero_academy.user_roles;
DROP POLICY IF EXISTS "admin dapat membaca user_roles" ON utero_academy.user_roles;
CREATE POLICY "admin dapat membaca user_roles"
ON utero_academy.user_roles
FOR SELECT
TO authenticated
USING (
  utero_academy.current_user_has_role('admin')
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "super_admin dapat mengelola user_roles" ON utero_academy.user_roles;
DROP POLICY IF EXISTS "admin dapat mengelola user_roles" ON utero_academy.user_roles;
CREATE POLICY "admin dapat mengelola user_roles"
ON utero_academy.user_roles
FOR ALL
TO authenticated
USING (
  utero_academy.current_user_has_role('admin')
)
WITH CHECK (
  utero_academy.current_user_has_role('admin')
);

DROP POLICY IF EXISTS "super_admin dapat mengelola user_profiles" ON utero_academy.user_profiles;
DROP POLICY IF EXISTS "admin dapat mengelola user_profiles" ON utero_academy.user_profiles;
CREATE POLICY "admin dapat mengelola user_profiles"
ON utero_academy.user_profiles
FOR ALL
TO authenticated
USING (
  utero_academy.current_user_has_role('admin')
  OR id = auth.uid()
)
WITH CHECK (
  utero_academy.current_user_has_role('admin')
  OR id = auth.uid()
);
