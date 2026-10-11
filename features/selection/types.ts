export const selectionQuestionTypes = [
  "multiple_choice",
  "true_false",
  "short_answer",
  "essay",
  "file_upload",
] as const;

export type SelectionQuestionType = (typeof selectionQuestionTypes)[number];
export type SelectionStatus =
  | "not_assigned"
  | "assigned"
  | "available"
  | "in_progress"
  | "submitted"
  | "grading"
  | "passed"
  | "failed"
  | "expired"
  | "bypassed";

export type SelectionTrack = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
};

export type SelectionMaterial = {
  id: string;
  track_id: string;
  title: string;
  content: { body?: string };
  attachment_path: string | null;
  order_index: number;
  is_published: boolean;
};

export type SelectionTest = {
  id: string;
  track_id: string;
  title: string;
  description: string | null;
  version: number;
  passing_score: number;
  code: string;
  duration_minutes: number;
  max_attempts: number;
  is_published: boolean;
};

export type SelectionQuestionOption = {
  id: string;
  question_id: string;
  label: string;
  is_correct: boolean;
  order_index: number;
};

export type SelectionQuestion = {
  id: string;
  package_id: string;
  question_type: SelectionQuestionType;
  prompt: { text?: string };
  points: number;
  order_index: number;
  answer_key: { value?: string } | null;
  options?: SelectionQuestionOption[];
};

export type SelectionAssignmentReview = {
  id: string;
  application_id: string;
  package_id: string;
  status: SelectionStatus;
  assigned_at: string;
  due_at: string | null;
  applicant: { full_name: string; email: string; major: string | null } | null;
  test: { title: string; passing_score: number; version: number } | null;
  attempt: {
    id: string;
    status: string;
    final_score: number | null;
    submitted_at: string | null;
    answers: Array<{
      id: string;
      question_id: string;
      answer_text: string | null;
      attachment_path: string | null;
      manual_score: number | null;
      feedback: string | null;
      question: { prompt: string; type: SelectionQuestionType; points: number } | null;
    }>;
  } | null;
};

export type SelectionWorkspace = {
  tracks: SelectionTrack[];
  materials: SelectionMaterial[];
  tests: SelectionTest[];
  questions: SelectionQuestion[];
  applications: Array<{ id: string; full_name: string; email: string; major: string | null; selection_status: string | null }>;
  assignments: SelectionAssignmentReview[];
};
