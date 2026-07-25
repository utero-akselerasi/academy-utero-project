-- Migration 0021: Add course completion certificate
-- Date: 2026-07-25

-- 1. Tambah kolom course_id di tabel certificates untuk reference course completion
ALTER TABLE utero_academy.certificates 
ADD COLUMN course_id uuid REFERENCES utero_academy.courses(id) ON DELETE SET NULL;

-- 2. Tambah kolom certificate_type untuk membedakan jenis sertifikat
ALTER TABLE utero_academy.certificates 
ADD COLUMN certificate_type text DEFAULT 'assessment';

-- 3. Create index untuk query performance
CREATE INDEX IF NOT EXISTS idx_certificates_course ON utero_academy.certificates(course_id);
CREATE INDEX IF NOT EXISTS idx_certificates_intern_course ON utero_academy.certificates(intern_id, course_id);

-- 4. Tambah comment untuk dokumentasi
COMMENT ON COLUMN utero_academy.certificates.course_id IS 'ID course untuk sertifikat completion (NULL untuk sertifikat assessment)';
COMMENT ON COLUMN utero_academy.certificates.certificate_type IS 'Jenis sertifikat: assessment atau course_completion';

-- 5. Tambah constraint untuk certificate_type
ALTER TABLE utero_academy.certificates 
ADD CONSTRAINT check_certificate_type 
CHECK (certificate_type IN ('assessment', 'course_completion'));
