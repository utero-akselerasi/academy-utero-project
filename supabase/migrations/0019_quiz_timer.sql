-- Migration 0019: Add quiz timer and timing tracking
-- Date: 2026-07-25

-- 1. Tambah kolom time_limit_minutes di tabel quizzes
ALTER TABLE utero_academy.quizzes 
ADD COLUMN time_limit_minutes integer DEFAULT NULL;

-- 2. Tambah kolom started_at dan finished_at di quiz_attempts untuk tracking waktu
ALTER TABLE utero_academy.quiz_attempts 
ADD COLUMN started_at timestamptz DEFAULT now(),
ADD COLUMN finished_at timestamptz;

-- 3. Tambah comment untuk dokumentasi
COMMENT ON COLUMN utero_academy.quizzes.time_limit_minutes IS 'Batas waktu pengerjaan kuis dalam menit (NULL = tanpa batas waktu)';
COMMENT ON COLUMN utero_academy.quiz_attempts.started_at IS 'Waktu mulai mengerjakan kuis';
COMMENT ON COLUMN utero_academy.quiz_attempts.finished_at IS 'Waktu selesai submit kuis';

-- 4. Create index untuk query performance
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_timing ON utero_academy.quiz_attempts(quiz_id, intern_id, started_at);
