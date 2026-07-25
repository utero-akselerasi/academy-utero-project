-- Migration 0020: Add discussion comments for lessons
-- Date: 2026-07-25

-- 1. Buat function untuk auto-update updated_at (jika belum ada)
CREATE OR REPLACE FUNCTION utero_academy.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Buat tabel lesson_comments untuk diskusi per lesson
CREATE TABLE IF NOT EXISTS utero_academy.lesson_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES utero_academy.lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES utero_academy.lesson_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_pinned boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create indexes untuk performance
CREATE INDEX IF NOT EXISTS idx_lesson_comments_lesson ON utero_academy.lesson_comments(lesson_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_comments_parent ON utero_academy.lesson_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_lesson_comments_user ON utero_academy.lesson_comments(user_id);

-- 4. Tambah trigger untuk updated_at
DROP TRIGGER IF EXISTS trigger_lesson_comments_updated_at ON utero_academy.lesson_comments;
CREATE TRIGGER trigger_lesson_comments_updated_at
  BEFORE UPDATE ON utero_academy.lesson_comments
  FOR EACH ROW
  EXECUTE FUNCTION utero_academy.update_updated_at_column();

-- 5. Tambah comment untuk dokumentasi
COMMENT ON TABLE utero_academy.lesson_comments IS 'Komentar diskusi per lesson dengan support nested replies';
COMMENT ON COLUMN utero_academy.lesson_comments.parent_comment_id IS 'NULL untuk komentar utama, berisi ID untuk reply';
COMMENT ON COLUMN utero_academy.lesson_comments.is_pinned IS 'Komentar penting yang di-pin oleh mentor';
