// ============================================
// LMS TYPES
// ============================================

// Core LMS Types
export interface Course {
  id: string;
  program_id?: string;
  title: string;
  description?: string;
  slug: string;
  status: "draft" | "published";
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  content: string; // HTML content
  video_url?: string;
  attachments?: any[]; // JSONB
  order_index: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Quiz {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  questions: any; // JSONB
  passing_score: number;
  time_limit_minutes?: number;
  max_attempts?: number;
  retry_delay_minutes: number;
  order_index: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  deadline?: string;
  max_score: number;
  order_index: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// PRIORITY 2: USER ENGAGEMENT TYPES
// ============================================

// Badges & Achievements
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "course" | "quiz" | "assignment" | "streak" | "social";
  criteria: any; // JSONB
  points: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  progress?: any; // JSONB
  created_at: string;
  badge?: Badge;
}

export interface UserPoints {
  id: string;
  user_id: string;
  total_points: number;
  points_this_month: number;
  points_this_week: number;
  level: number;
  level_progress: number;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface PointTransaction {
  id: string;
  user_id: string;
  points: number;
  activity_type: string;
  reference_id?: string;
  description?: string;
  created_at: string;
}

// Learning Analytics
export interface LearningSession {
  id: string;
  user_id: string;
  lesson_id?: string;
  course_id?: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  activity_type: string;
  created_at: string;
}

export interface DailyActivity {
  id: string;
  user_id: string;
  activity_date: string;
  lessons_completed: number;
  quizzes_taken: number;
  assignments_submitted: number;
  total_time_seconds: number;
  points_earned: number;
  created_at: string;
  updated_at: string;
}

export interface UserStreak {
  id: string;
  user_id: string;
  current_streak_days: number;
  longest_streak_days: number;
  last_activity_date?: string;
  created_at: string;
  updated_at: string;
}

// Course Announcements
export interface CourseAnnouncement {
  id: string;
  course_id: string;
  author_id: string;
  title: string;
  content: string;
  priority: "low" | "normal" | "high" | "urgent";
  is_pinned: boolean;
  is_published: boolean;
  published_at?: string;
  created_at: string;
  updated_at: string;
  author?: {
    full_name: string;
  };
  is_read?: boolean;
}

export interface AnnouncementRead {
  id: string;
  announcement_id: string;
  user_id: string;
  read_at: string;
  created_at: string;
}

// Lesson Bookmarks
export interface LessonBookmark {
  id: string;
  user_id: string;
  lesson_id: string;
  note?: string;
  created_at: string;
  updated_at: string;
  lesson?: {
    title: string;
    course_id: string;
  };
}

// Quiz Retry Limit
export interface QuizAttemptStatus {
  can_attempt: boolean;
  reason: string;
  attempts_used: number;
  attempts_remaining: number;
  next_attempt_at?: string;
}

export interface QuizAttemptSummary {
  user_id: string;
  quiz_id: string;
  quiz_title: string;
  max_attempts?: number;
  attempts_used: number;
  attempts_remaining: number;
  best_score?: number;
  last_attempt_at?: string;
  ever_passed: boolean;
}
