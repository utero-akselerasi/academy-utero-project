import { describe, expect, it } from "vitest";
import { bypassSchema, createQuestionSchema, parseOptionLines } from "../features/selection/schemas";
import { calculateSelectionScore, recommendedSelectionDecision } from "../features/selection/scoring";

describe("selection domain", () => {
  it("requires substantial bypass reason", () => {
    expect(bypassSchema.safeParse({ applicationId: crypto.randomUUID(), reason: "too short" }).success).toBe(false);
    expect(bypassSchema.safeParse({ applicationId: crypto.randomUUID(), reason: "Keputusan khusus sudah diperiksa dan disetujui." }).success).toBe(true);
  });
  it("rejects invalid answer keys", () => {
    expect(createQuestionSchema.safeParse({ testId: crypto.randomUUID(), type: "multiple_choice", prompt: "Contoh?", points: 10, options: "A\nB", correctOption: "C" }).success).toBe(false);
    expect(parseOptionLines(" A\nB\nA ")).toEqual(["A", "B"]);
  });
  it("does not decide before every answer is graded", () => {
    expect(calculateSelectionScore([{ maxPoints: 10, awardedPoints: 10 }, { maxPoints: 10, awardedPoints: null }])).toBeNull();
    expect(recommendedSelectionDecision(null, 70)).toBe("grading");
    expect(calculateSelectionScore([{ maxPoints: 10, awardedPoints: 7 }])).toBe(70);
    expect(recommendedSelectionDecision(70, 70)).toBe("passed");
  });
});
