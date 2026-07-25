-- Migration: 0024_course_announcements.sql
-- Description: Sistem announcement untuk course (broadcast info ke peserta)
-- Created: 2026-07-25

-- ============================================
-- 1. TABEL COURSE ANNOUNCEMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS utero_academy.course_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES utero_academy.courses(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    is_pinned BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT true,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. TABEL ANNOUNCEMENT READS (Track yang sudah dibaca)
-- ============================================
CREATE TABLE IF NOT EXISTS utero_academy.announcement_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES utero_academy.course_announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(announcement_id, user_id)
);

-- ============================================
-- 3. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_course_announcements_course_id ON utero_academy.course_announcements(course_id);
CREATE INDEX IF NOT EXISTS idx_course_announcements_author_id ON utero_academy.course_announcements(author_id);
CREATE INDEX IF NOT EXISTS idx_course_announcements_published_at ON utero_academy.course_announcements(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_announcements_pinned ON utero_academy.course_announcements(is_pinned, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement_id ON utero_academy.announcement_reads(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user_id ON utero_academy.announcement_reads(user_id);

-- ============================================
-- 4. TRIGGERS
-- ============================================
CREATE TRIGGER update_course_announcements_updated_at
    BEFORE UPDATE ON utero_academy.course_announcements
    FOR EACH ROW
    EXECUTE FUNCTION utero_academy.update_updated_at_column();

-- Auto-set published_at when is_published changes to true
CREATE OR REPLACE FUNCTION utero_academy.set_announcement_published_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_published = true AND OLD.is_published = false THEN
        NEW.published_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_announcement_published_at_trigger
    BEFORE UPDATE ON utero_academy.course_announcements
    FOR EACH ROW
    EXECUTE FUNCTION utero_academy.set_announcement_published_at();

COMMENT ON TABLE utero_academy.course_announcements IS 'Announcement/pengumuman per course';
COMMENT ON TABLE utero_academy.announcement_reads IS 'Tracking announcement yang sudah dibaca user';
