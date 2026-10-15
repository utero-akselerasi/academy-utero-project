import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("applicant selection local backend", () => {
  it("routes reads and mutations through the self-hosted API before Supabase", () => {
    const reads = readFileSync(resolve(process.cwd(), "features/selection/applicant.ts"), "utf8");
    const actions = readFileSync(resolve(process.cwd(), "features/selection/applicant-actions.ts"), "utf8");
    expect(reads).toContain("usesLocalBackend()");
    expect(reads).toContain('backendRequest("/v1/registration/selection")');
    expect(actions).toContain("usesLocalBackend()");
    expect(actions).toContain("/v1/registration/selection/${assignmentId}/start");
    expect(actions).toContain("/v1/registration/selection/${assignmentId}/answers/${questionId}");
    expect(actions).toContain("/v1/registration/selection/${assignmentId}/submit");
  });
});
