-- Migration: 0025_lesson_bookmarks.sql
-- Description: Fitur bookmark untuk menandai lesson penting
-- Created: 2026-07-25

-- ============================================
-- 1. TABEL LESSON BOOKMARKS
-- ============================================
CREATE TABLE IF NOT EXISTS utero_academy.lesson_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES utero_academy.lessons(id) ON DELETE CASCADE,
    note TEXT, -- Optional note untuk bookmark
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, lesson_id)
);

-- ============================================
-- 2. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lesson_bookmarks_user_id ON utero_academy.lesson_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_bookmarks_lesson_id ON utero_academy.lesson_bookmarks(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_bookmarks_created_at ON utero_academy.lesson_bookmarks(created_at DESC);

-- ============================================
-- 3. TRIGGERS
-- ============================================
CREATE TRIGGER update_lesson_bookmarks_updated_at
    BEFORE UPDATE ON utero_academy.lesson_bookmarks
    FOR EACH ROW
    EXECUTE FUNCTION utero_academy.update_updated_at_column();

COMMENT ON TABLE utero_academy.lesson_bookmarks IS 'Bookmark lesson yang ditandai user sebagai penting';
