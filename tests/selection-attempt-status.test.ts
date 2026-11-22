import { describe, expect, it } from "vitest";
import { effectiveAttemptStatus } from "@/features/selection/attempt-status";

const now = Date.parse("2026-11-22T12:00:00Z");
const later = "2026-11-22T13:00:00Z";
const earlier = "2026-11-22T11:00:00Z";

describe("effectiveAttemptStatus", () => {
  it("marks timed-out attempts expired, including assignment and test deadlines", () => {
    expect(effectiveAttemptStatus({ status: "in_progress", expires_at: earlier }, null, null, now)).toBe("expired");
    expect(effectiveAttemptStatus({ status: "in_progress", expires_at: later }, earlier, null, now)).toBe("expired");
    expect(effectiveAttemptStatus({ status: "in_progress", expires_at: later }, null, earlier, now)).toBe("expired");
    expect(effectiveAttemptStatus({ status: "in_progress", expires_at: null }, null, null, now)).toBe("expired");
  });

  it("keeps active and submitted attempts distinct from expired attempts", () => {
    expect(effectiveAttemptStatus({ status: "in_progress", expires_at: later }, null, null, now)).toBe("in_progress");
    expect(effectiveAttemptStatus({ status: "in_progress", expires_at: earlier }, null, null, Date.parse(earlier))).toBe("expired");
    expect(effectiveAttemptStatus({ status: "grading", expires_at: earlier }, null, null, now)).toBe("grading");
    expect(effectiveAttemptStatus({ status: "graded", expires_at: earlier }, null, null, now)).toBe("graded");
    expect(effectiveAttemptStatus(null, null, null, now)).toBeUndefined();
  });
});
