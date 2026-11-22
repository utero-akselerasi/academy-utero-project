import { describe, expect, it } from "vitest";
import { reviewDuration, reviewStatus, reviewTime } from "@/features/selection/review-display";
import type { SelectionAssignmentReview } from "@/features/selection/types";

const assignment = {
  id: "assignment", application_id: "application", package_id: "package", status: "in_progress",
  assigned_at: "2026-11-22T09:00:00Z", due_at: null, applicant: null, test: null,
  attempt: { id: "attempt", status: "in_progress", started_at: "2026-11-22T10:00:00Z", expires_at: "2026-11-22T11:00:00Z", submitted_at: null, final_score: null, answers: [] },
} satisfies SelectionAssignmentReview;

describe("review selection timing", () => {
  it("shows effective expired status and caps duration at expiry", () => {
    const now = Date.parse("2026-11-22T12:00:00Z");
    expect(reviewStatus(assignment, now).label).toBe("Waktu habis");
    expect(reviewDuration(assignment, now)).toBe("1 jam 0 menit");
  });

  it("uses submission time instead of grading time", () => {
    const submitted = { ...assignment, attempt: { ...assignment.attempt, status: "graded", submitted_at: "2026-11-22T10:34:00Z" } };
    expect(reviewDuration(submitted, Date.parse("2026-11-23T12:00:00Z"))).toBe("34 menit");
    expect(reviewStatus(submitted, Date.now()).label).toBe("Menunggu keputusan");
    expect(reviewTime(submitted.attempt.submitted_at)).toContain("November 2026");
  });

  it("does not invent a duration before test starts", () => {
    expect(reviewDuration({ ...assignment, attempt: null }, Date.now())).toBe("Belum dimulai");
  });

  it("does not call a graded result final before applicant decision", () => {
    const graded = { ...assignment, status: "passed" as const, applicant: { full_name: "Peserta", email: "peserta@example.test", major: null, selection_status: "in_progress" }, attempt: { ...assignment.attempt, status: "graded", submitted_at: "2026-11-22T10:34:00Z" } };
    expect(reviewStatus(graded, Date.now()).label).toBe("Menunggu keputusan");
    expect(reviewStatus({ ...graded, applicant: { ...graded.applicant, selection_status: "passed" } }, Date.now()).label).toBe("Lulus");
  });
});
