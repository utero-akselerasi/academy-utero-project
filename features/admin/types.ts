export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "reviewed"
  | "accepted"
  | "rejected"
  | "cancelled";

export type InternshipApplication = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  school_name: string | null;
  major: string | null;
  motivation: string | null;
  status: ApplicationStatus;
  cv_path?: string | null;
  portfolio_path?: string | null;
  created_at: string;
  selection_status?: string | null;
  proposed_start_date?: string | null;
  proposed_end_date?: string | null;
  approved_start_date?: string | null;
  approved_end_date?: string | null;
  applicant_user_id?: string | null;
};

