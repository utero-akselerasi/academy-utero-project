-- Migration: 0023_learning_analytics.sql
-- Description: Tabel untuk tracking analytics pembelajaran peserta
-- Created: 2026-07-25

-- ============================================
-- 1. TABEL LEARNING SESSIONS (Tracking Waktu Belajar)
-- ============================================
CREATE TABLE IF NOT EXISTS utero_academy.learning_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES utero_academy.lessons(id) ON DELETE CASCADE,
    course_id UUID REFERENCES utero_academy.courses(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    activity_type VARCHAR(50), -- 'lesson_view', 'quiz_attempt', 'assignment_work'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. TABEL DAILY ACTIVITY (Agregasi Harian)
-- ============================================
CREATE TABLE IF NOT EXISTS utero_academy.daily_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    lessons_completed INTEGER DEFAULT 0,
    quizzes_taken INTEGER DEFAULT 0,
    assignments_submitted INTEGER DEFAULT 0,
    total_time_seconds INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, activity_date)
);

-- ============================================
-- 3. TABEL USER STREAKS (Login & Learning Streaks)
-- ============================================
CREATE TABLE IF NOT EXISTS utero_academy.user_streaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    current_streak_days INTEGER DEFAULT 0,
    longest_streak_days INTEGER DEFAULT 0,
    last_activity_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============================================
-- 4. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_id ON utero_academy.learning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_course_id ON utero_academy.learning_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_started_at ON utero_academy.learning_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_activity_user_id ON utero_academy.daily_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_activity_date ON utero_academy.daily_activity(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON utero_academy.user_streaks(user_id);

-- ============================================
-- 5. TRIGGERS
-- ============================================
CREATE TRIGGER update_daily_activity_updated_at
    BEFORE UPDATE ON utero_academy.daily_activity
    FOR EACH ROW
    EXECUTE FUNCTION utero_academy.update_updated_at_column();

CREATE TRIGGER update_user_streaks_updated_at
    BEFORE UPDATE ON utero_academy.user_streaks
    FOR EACH ROW
    EXECUTE FUNCTION utero_academy.update_updated_at_column();

-- ============================================
-- 6. FUNCTION: Update Daily Activity
-- ============================================
CREATE OR REPLACE FUNCTION utero_academy.update_daily_activity(
    p_user_id UUID,
    p_activity_type VARCHAR(50),
    p_time_seconds INTEGER DEFAULT 0,
    p_points INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO utero_academy.daily_activity (
        user_id, 
        activity_date,
        lessons_completed,
        quizzes_taken,
        assignments_submitted,
        total_time_seconds,
        points_earned
    )
    VALUES (
        p_user_id,
        CURRENT_DATE,
        CASE WHEN p_activity_type = 'lesson_completed' THEN 1 ELSE 0 END,
        CASE WHEN p_activity_type = 'quiz_taken' THEN 1 ELSE 0 END,
        CASE WHEN p_activity_type = 'assignment_submitted' THEN 1 ELSE 0 END,
        p_time_seconds,
        p_points
    )
    ON CONFLICT (user_id, activity_date) DO UPDATE
    SET
        lessons_completed = daily_activity.lessons_completed + 
            CASE WHEN p_activity_type = 'lesson_completed' THEN 1 ELSE 0 END,
        quizzes_taken = daily_activity.quizzes_taken + 
            CASE WHEN p_activity_type = 'quiz_taken' THEN 1 ELSE 0 END,
        assignments_submitted = daily_activity.assignments_submitted + 
            CASE WHEN p_activity_type = 'assignment_submitted' THEN 1 ELSE 0 END,
        total_time_seconds = daily_activity.total_time_seconds + p_time_seconds,
        points_earned = daily_activity.points_earned + p_points,
        updated_at = NOW();
END;
$$;

-- ============================================
-- 7. FUNCTION: Update User Streak
-- ============================================
CREATE OR REPLACE FUNCTION utero_academy.update_user_streak(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_last_date DATE;
    v_current_streak INTEGER;
    v_longest_streak INTEGER;
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Get current streak info
    SELECT last_activity_date, current_streak_days, longest_streak_days
    INTO v_last_date, v_current_streak, v_longest_streak
    FROM utero_academy.user_streaks
    WHERE user_id = p_user_id;
    
    -- If no record exists, create one
    IF NOT FOUND THEN
        INSERT INTO utero_academy.user_streaks (user_id, current_streak_days, longest_streak_days, last_activity_date)
        VALUES (p_user_id, 1, 1, v_today);
        RETURN;
    END IF;
    
    -- If already logged today, do nothing
    IF v_last_date = v_today THEN
        RETURN;
    END IF;
    
    -- If yesterday, increment streak
    IF v_last_date = v_today - INTERVAL '1 day' THEN
        v_current_streak := v_current_streak + 1;
        IF v_current_streak > v_longest_streak THEN
            v_longest_streak := v_current_streak;
        END IF;
    ELSE
        -- Streak broken, reset to 1
        v_current_streak := 1;
    END IF;
    
    -- Update streak
    UPDATE utero_academy.user_streaks
    SET 
        current_streak_days = v_current_streak,
        longest_streak_days = v_longest_streak,
        last_activity_date = v_today,
        updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$;

COMMENT ON TABLE utero_academy.learning_sessions IS 'Tracking sesi belajar dan waktu yang dihabiskan';
COMMENT ON TABLE utero_academy.daily_activity IS 'Agregasi aktivitas harian user';
COMMENT ON TABLE utero_academy.user_streaks IS 'Tracking streak login dan aktivitas belajar';
