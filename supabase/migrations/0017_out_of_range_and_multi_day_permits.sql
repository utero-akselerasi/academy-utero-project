-- Migration 0017: Add out_of_range support to attendances and multi-day permits

-- 1. Tambah kolom pengecualian Geofencing ke tabel attendances
ALTER TABLE utero_academy.attendances 
ADD COLUMN IF NOT EXISTS is_out_of_range boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS out_of_range_reason text,
ADD COLUMN IF NOT EXISTS out_of_range_proof_path text;

-- 2. Buat tabel permits untuk izin/sakit multi-hari
CREATE TABLE IF NOT EXISTS utero_academy.permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intern_id uuid NOT NULL REFERENCES utero_academy.intern_profiles(id) ON DELETE CASCADE,
  permit_type text NOT NULL CHECK (permit_type IN ('permit', 'sick')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL,
  attachment_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index untuk mempercepat query
CREATE INDEX IF NOT EXISTS idx_permits_intern_id ON utero_academy.permits(intern_id);
CREATE INDEX IF NOT EXISTS idx_permits_dates ON utero_academy.permits(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_permits_status ON utero_academy.permits(status);

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_permits_updated_at ON utero_academy.permits;
CREATE TRIGGER set_permits_updated_at
BEFORE UPDATE ON utero_academy.permits
FOR EACH ROW EXECUTE FUNCTION utero_academy.set_updated_at();

-- Grants
GRANT ALL PRIVILEGES ON TABLE utero_academy.permits TO service_role;
GRANT SELECT ON TABLE utero_academy.permits TO authenticated;
