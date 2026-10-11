export const APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "reviewed",
  "document_review",
  "revision_requested",
  "selection",
  "waitlisted",
  "accepted",
  "rejected",
  "cancelled",
  "converted",
] as const;

export const SELECTION_STATUSES = [
  "not_assigned",
  "assigned",
  "available",
  "in_progress",
  "submitted",
  "grading",
  "passed",
  "failed",
  "expired",
  "bypassed",
] as const;

export const ONBOARDING_STATUSES = [
  "not_started",
  "accepted_pending_onboarding",
  "biodata_review",
  "onboarding_complete",
  "waiting_start",
  "active",
  "paused",
  "completed",
  "failed",
  "alumni",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export type SelectionStatus = (typeof SELECTION_STATUSES)[number];
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export type SchoolPartnerContext = {
  id: string;
  name: string;
  partnershipStatus: string;
};

export type SchoolApplication = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  studentNumber: string | null;
  major: string | null;
  motivation: string | null;
  status: ApplicationStatus;
  selectionStatus: SelectionStatus;
  onboardingStatus: OnboardingStatus;
  proposedStartDate: string | null;
  proposedEndDate: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  applicantUserId: string | null;
};

export type PublicSelectionResult = {
  decisionId: string;
  result: string;
  finalScore: number | null;
  publicNote: string | null;
  decidedAt: string;
};

export type ApplicationFilters = {
  query?: string;
  status?: ApplicationStatus | "all";
  selectionStatus?: SelectionStatus | "all";
};

export type BulkImportRowResult = {
  row: number;
  fullName: string;
  email: string;
  studentNumber: string;
  status: "created" | "invalid" | "duplicate";
  errors: string[];
};

export type BulkImportState = {
  ok: boolean;
  message: string;
  total: number;
  created: number;
  failed: number;
  rows: BulkImportRowResult[];
};

export type CreateApplicationState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
};
