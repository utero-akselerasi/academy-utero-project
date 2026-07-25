-- Migration 0018: Add rich content support and attachments for LMS lessons
-- Date: 2026-07-25

-- 1. Ubah lessons.content dari JSONB ke TEXT untuk HTML content
-- Kita akan migrate existing JSONB content ke HTML format
ALTER TABLE utero_academy.lessons ALTER COLUMN content TYPE text USING content::text;

-- 2. Tambah kolom attachments untuk file resources per lesson
ALTER TABLE utero_academy.lessons 
ADD COLUMN attachments jsonb DEFAULT '[]'::jsonb;

-- 3. Tambah comment untuk dokumentasi
COMMENT ON COLUMN utero_academy.lessons.content IS 'HTML content dari rich text editor';
COMMENT ON COLUMN utero_academy.lessons.attachments IS 'Array of attachment objects: [{id, name, path, size, type, uploaded_at}]';

-- 4. Create index untuk query performance
CREATE INDEX IF NOT EXISTS idx_lessons_course_order ON utero_academy.lessons(course_id, order_index);
