-- Migration: 0022_badges_and_achievements_system.sql
-- Description: Implementasi sistem badges dan achievements untuk gamification
-- Created: 2026-07-25

-- ============================================
-- 1. TABEL BADGES (Master Badges)
-- ============================================
CREATE TABLE IF NOT EXISTS utero_academy.badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50), -- emoji atau icon name
    category VARCHAR(50) NOT NULL, -- 'course', 'quiz', 'assignment', 'streak', 'social'
    criteria JSONB NOT NULL, -- {type: 'complete_courses', count: 5}
    points INTEGER DEFAULT 0,
    rarity VARCHAR(20) DEFAULT 'common', -- 'common', 'rare', 'epic', 'legendary'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. TABEL USER BADGES (Badges yang Dimiliki User)
-- ============================================
CREATE TABLE IF NOT EXISTS utero_academy.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES utero_academy.badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    progress JSONB, -- tracking progress menuju badge
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
);

-- ============================================
-- 3. TABEL USER POINTS (Point System)
-- ============================================
CREATE TABLE IF NOT EXISTS utero_academy.user_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_points INTEGER DEFAULT 0,
    points_this_month INTEGER DEFAULT 0,
    points_this_week INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    level_progress INTEGER DEFAULT 0, -- 0-100%
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============================================
-- 4. TABEL POINT TRANSACTIONS (History Point)
-- ============================================
CREATE TABLE IF NOT EXISTS utero_academy.point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    activity_type VARCHAR(50) NOT NULL, -- 'lesson_completed', 'quiz_passed', 'assignment_submitted', etc.
    reference_id UUID, -- ID dari lesson/quiz/assignment
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON utero_academy.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON utero_academy.user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_earned_at ON utero_academy.user_badges(earned_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON utero_academy.user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_total_points ON utero_academy.user_points(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON utero_academy.point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at ON utero_academy.point_transactions(created_at DESC);

-- ============================================
-- 6. TRIGGERS
-- ============================================
CREATE TRIGGER update_badges_updated_at
    BEFORE UPDATE ON utero_academy.badges
    FOR EACH ROW
    EXECUTE FUNCTION utero_academy.update_updated_at_column();

CREATE TRIGGER update_user_points_updated_at
    BEFORE UPDATE ON utero_academy.user_points
    FOR EACH ROW
    EXECUTE FUNCTION utero_academy.update_updated_at_column();

-- ============================================
-- 7. SEED DEFAULT BADGES
-- ============================================
INSERT INTO utero_academy.badges (name, description, icon, category, criteria, points, rarity) VALUES
-- Course Completion Badges
('First Step', 'Complete your first course', '🎯', 'course', '{"type": "complete_courses", "count": 1}', 50, 'common'),
('Knowledge Seeker', 'Complete 5 courses', '📚', 'course', '{"type": "complete_courses", "count": 5}', 200, 'rare'),
('Master Learner', 'Complete 10 courses', '🎓', 'course', '{"type": "complete_courses", "count": 10}', 500, 'epic'),
('Knowledge Champion', 'Complete 20 courses', '👑', 'course', '{"type": "complete_courses", "count": 20}', 1000, 'legendary'),

-- Quiz Badges
('Quiz Novice', 'Pass your first quiz', '✏️', 'quiz', '{"type": "quiz_passed", "count": 1}', 30, 'common'),
('Quiz Master', 'Pass 10 quizzes with 90%+ score', '🏆', 'quiz', '{"type": "quiz_perfect", "count": 10, "min_score": 90}', 300, 'rare'),
('Perfect Score', 'Get 100% on any quiz', '💯', 'quiz', '{"type": "quiz_perfect_score", "count": 1}', 100, 'rare'),

-- Assignment Badges
('Task Starter', 'Submit your first assignment', '📝', 'assignment', '{"type": "assignment_submitted", "count": 1}', 30, 'common'),
('Assignment Pro', 'Submit 10 assignments', '📋', 'assignment', '{"type": "assignment_submitted", "count": 10}', 250, 'rare'),
('Excellence', 'Get 5 assignments graded 90+', '⭐', 'assignment', '{"type": "assignment_excellence", "count": 5, "min_score": 90}', 300, 'epic'),

-- Streak Badges
('Consistent Learner', 'Login 7 days in a row', '🔥', 'streak', '{"type": "login_streak", "days": 7}', 150, 'rare'),
('Dedication', 'Login 30 days in a row', '💪', 'streak', '{"type": "login_streak", "days": 30}', 500, 'epic'),

-- Social Badges
('Helpful', 'Post 10 helpful comments', '💬', 'social', '{"type": "comments_posted", "count": 10}', 100, 'common'),
('Discussion Leader', 'Get 5 pinned comments', '📌', 'social', '{"type": "comments_pinned", "count": 5}', 200, 'rare')
ON CONFLICT DO NOTHING;

-- ============================================
-- 8. FUNCTION: Award Points
-- ============================================
CREATE OR REPLACE FUNCTION utero_academy.award_points(
    p_user_id UUID,
    p_points INTEGER,
    p_activity_type VARCHAR(50),
    p_reference_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_total INTEGER;
    v_new_level INTEGER;
BEGIN
    -- Insert point transaction
    INSERT INTO utero_academy.point_transactions (user_id, points, activity_type, reference_id, description)
    VALUES (p_user_id, p_points, p_activity_type, p_reference_id, p_description);
    
    -- Update or create user_points
    INSERT INTO utero_academy.user_points (user_id, total_points, points_this_month, points_this_week, last_activity_at)
    VALUES (p_user_id, p_points, p_points, p_points, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET 
        total_points = user_points.total_points + p_points,
        points_this_month = user_points.points_this_month + p_points,
        points_this_week = user_points.points_this_week + p_points,
        last_activity_at = NOW()
    RETURNING total_points INTO v_new_total;
    
    -- Calculate new level (100 points per level)
    v_new_level := FLOOR(v_new_total / 100.0) + 1;
    
    UPDATE utero_academy.user_points
    SET 
        level = v_new_level,
        level_progress = ((v_new_total % 100) * 100) / 100
    WHERE user_id = p_user_id;
END;
$$;

-- ============================================
-- 9. FUNCTION: Check and Award Badges
-- ============================================
CREATE OR REPLACE FUNCTION utero_academy.check_and_award_badges(p_user_id UUID, p_category VARCHAR(50))
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    badge_record RECORD;
    criteria_data JSONB;
    user_progress INTEGER;
    should_award BOOLEAN;
    v_intern_id UUID;
BEGIN
    -- Get intern_id from user_id for quiz/assignment queries
    SELECT id INTO v_intern_id
    FROM utero_academy.intern_profiles
    WHERE user_id = p_user_id;
    
    FOR badge_record IN 
        SELECT * FROM utero_academy.badges 
        WHERE category = p_category AND is_active = true
    LOOP
        -- Skip if user already has this badge
        IF EXISTS (SELECT 1 FROM utero_academy.user_badges WHERE user_id = p_user_id AND badge_id = badge_record.id) THEN
            CONTINUE;
        END IF;
        
        criteria_data := badge_record.criteria;
        should_award := false;
        
        -- Check criteria based on type
        IF criteria_data->>'type' = 'complete_courses' THEN
            SELECT COUNT(*) INTO user_progress
            FROM utero_academy.course_enrollments
            WHERE user_id = p_user_id AND completed_at IS NOT NULL;
            
            should_award := user_progress >= (criteria_data->>'count')::INTEGER;
            
        ELSIF criteria_data->>'type' = 'quiz_passed' THEN
            IF v_intern_id IS NOT NULL THEN
                SELECT COUNT(DISTINCT quiz_id) INTO user_progress
                FROM utero_academy.quiz_attempts qa
                JOIN utero_academy.quizzes q ON q.id = qa.quiz_id
                WHERE qa.intern_id = v_intern_id AND qa.score >= q.passing_score;
                
                should_award := user_progress >= (criteria_data->>'count')::INTEGER;
            END IF;
            
        ELSIF criteria_data->>'type' = 'quiz_perfect' THEN
            IF v_intern_id IS NOT NULL THEN
                SELECT COUNT(DISTINCT quiz_id) INTO user_progress
                FROM utero_academy.quiz_attempts
                WHERE intern_id = v_intern_id 
                    AND score >= COALESCE((criteria_data->>'min_score')::INTEGER, 90);
                
                should_award := user_progress >= (criteria_data->>'count')::INTEGER;
            END IF;
            
        ELSIF criteria_data->>'type' = 'quiz_perfect_score' THEN
            IF v_intern_id IS NOT NULL THEN
                should_award := EXISTS (
                    SELECT 1 FROM utero_academy.quiz_attempts
                    WHERE intern_id = v_intern_id AND score = 100
                    LIMIT 1
                );
            END IF;
            
        ELSIF criteria_data->>'type' = 'assignment_submitted' THEN
            IF v_intern_id IS NOT NULL THEN
                SELECT COUNT(*) INTO user_progress
                FROM utero_academy.assignment_submissions
                WHERE intern_id = v_intern_id AND submitted_at IS NOT NULL;
                
                should_award := user_progress >= (criteria_data->>'count')::INTEGER;
            END IF;
            
        ELSIF criteria_data->>'type' = 'comments_posted' THEN
            SELECT COUNT(*) INTO user_progress
            FROM utero_academy.lesson_comments
            WHERE user_id = p_user_id;
            
            should_award := user_progress >= (criteria_data->>'count')::INTEGER;
            
        ELSIF criteria_data->>'type' = 'comments_pinned' THEN
            SELECT COUNT(*) INTO user_progress
            FROM utero_academy.lesson_comments
            WHERE user_id = p_user_id AND is_pinned = true;
            
            should_award := user_progress >= (criteria_data->>'count')::INTEGER;
        END IF;
        
        -- Award badge if criteria met
        IF should_award THEN
            INSERT INTO utero_academy.user_badges (user_id, badge_id)
            VALUES (p_user_id, badge_record.id)
            ON CONFLICT DO NOTHING;
            
            -- Award points
            PERFORM utero_academy.award_points(
                p_user_id, 
                badge_record.points, 
                'badge_earned', 
                badge_record.id,
                'Earned badge: ' || badge_record.name
            );
        END IF;
    END LOOP;
END;
$$;

COMMENT ON TABLE utero_academy.badges IS 'Master table untuk semua badges yang tersedia';
COMMENT ON TABLE utero_academy.user_badges IS 'Badges yang dimiliki oleh user';
COMMENT ON TABLE utero_academy.user_points IS 'Point dan level user untuk gamification';
COMMENT ON TABLE utero_academy.point_transactions IS 'History semua transaksi point user';
