-- Migration 0015: Add is_published column to LMS components
ALTER TABLE utero_academy.lessons ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT true;
ALTER TABLE utero_academy.quizzes ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT true;
ALTER TABLE utero_academy.assignments ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT true;
