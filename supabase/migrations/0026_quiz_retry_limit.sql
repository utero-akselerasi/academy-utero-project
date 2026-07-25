-- Migration: 0026_quiz_retry_limit.sql
-- Description: Menambahkan limit retry pada quiz
-- Created: 2026-07-25

-- ============================================
-- 1. ALTER QUIZ TABLE - Add retry limit
-- ============================================
ALTER TABLE utero_academy.quizzes
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT NULL, -- NULL = unlimited
ADD COLUMN IF NOT EXISTS retry_delay_minutes INTEGER DEFAULT 0; -- Wait time between attempts

-- ============================================
-- 2. FUNCTION: Check if user can attempt quiz
-- ============================================
CREATE OR REPLACE FUNCTION utero_academy.can_attempt_quiz(
    p_user_id UUID,
    p_quiz_id UUID
)
RETURNS TABLE(
    can_attempt BOOLEAN,
    reason TEXT,
    attempts_used INTEGER,
    attempts_remaining INTEGER,
    next_attempt_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_max_attempts INTEGER;
    v_retry_delay INTEGER;
    v_attempts_count INTEGER;
    v_last_attempt TIMESTAMP WITH TIME ZONE;
    v_next_allowed TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get quiz settings
    SELECT max_attempts, retry_delay_minutes
    INTO v_max_attempts, v_retry_delay
    FROM utero_academy.quizzes
    WHERE id = p_quiz_id;
    
    -- Count user attempts
    SELECT COUNT(*), MAX(submitted_at)
    INTO v_attempts_count, v_last_attempt
    FROM utero_academy.quiz_attempts
    WHERE user_id = p_user_id AND quiz_id = p_quiz_id;
    
    -- Check max attempts limit
    IF v_max_attempts IS NOT NULL AND v_attempts_count >= v_max_attempts THEN
        RETURN QUERY SELECT 
            false,
            'Maximum attempts reached'::TEXT,
            v_attempts_count,
            0,
            NULL::TIMESTAMP WITH TIME ZONE;
        RETURN;
    END IF;
    
    -- Check retry delay
    IF v_retry_delay > 0 AND v_last_attempt IS NOT NULL THEN
        v_next_allowed := v_last_attempt + (v_retry_delay || ' minutes')::INTERVAL;
        
        IF NOW() < v_next_allowed THEN
            RETURN QUERY SELECT 
                false,
                'Please wait before retrying'::TEXT,
                v_attempts_count,
                COALESCE(v_max_attempts - v_attempts_count, -1),
                v_next_allowed;
            RETURN;
        END IF;
    END IF;
    
    -- Can attempt
    RETURN QUERY SELECT 
        true,
        'Can attempt quiz'::TEXT,
        v_attempts_count,
        COALESCE(v_max_attempts - v_attempts_count, -1),
        NULL::TIMESTAMP WITH TIME ZONE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. VIEW: Quiz Attempt Summary per User
-- ============================================
CREATE OR REPLACE VIEW utero_academy.user_quiz_attempts_summary AS
SELECT 
    qa.user_id,
    qa.quiz_id,
    q.title as quiz_title,
    q.max_attempts,
    COUNT(qa.id) as attempts_used,
    CASE 
        WHEN q.max_attempts IS NULL THEN -1
        ELSE q.max_attempts - COUNT(qa.id)
    END as attempts_remaining,
    MAX(qa.score) as best_score,
    MAX(qa.submitted_at) as last_attempt_at,
    BOOL_OR(qa.passed) as ever_passed
FROM utero_academy.quiz_attempts qa
JOIN utero_academy.quizzes q ON q.id = qa.quiz_id
GROUP BY qa.user_id, qa.quiz_id, q.title, q.max_attempts;

COMMENT ON COLUMN utero_academy.quizzes.max_attempts IS 'Maximum number of attempts allowed (NULL = unlimited)';
COMMENT ON COLUMN utero_academy.quizzes.retry_delay_minutes IS 'Minutes to wait between attempts';
