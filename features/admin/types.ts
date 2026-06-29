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
  created_at: string;
};

