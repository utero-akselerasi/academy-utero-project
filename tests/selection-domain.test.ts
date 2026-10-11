import { describe, expect, it } from "vitest";
import { bypassSchema, createQuestionSchema, parseOptionLines } from "../features/selection/schemas";
import { calculateSelectionScore, recommendedSelectionDecision } from "../features/selection/scoring";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("selection domain", () => {
  it("keeps answer uploads private and blocks direct or late answer writes", () => {
    const action = readFileSync(resolve(process.cwd(), "features/selection/applicant-actions.ts"), "utf8");
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/0040_secure_selection_answers.sql"), "utf8");
    expect(action).toContain('storage.from("selection-answers").upload');
    expect(action).toContain('storage.from("selection-answers").remove');
    expect(action).toContain("previousAttachmentPath");
    expect(action).not.toContain('storage.from("avatars")');
    expect(migration).toMatch(/values \('selection-answers', 'selection-answers', false\)/);
    expect(migration).toMatch(/revoke insert, update, delete on table utero_academy.selection_attempts from anon, authenticated/);
    expect(migration).toMatch(/revoke insert, update, delete on table utero_academy.selection_answers from anon, authenticated/);
    expect(migration).toContain("clock_timestamp() >= attempt_row.expires_at");
    expect(migration).toContain("clock_timestamp() >= deadline");
    expect(migration).toContain("before insert or update on utero_academy.selection_answers");
  });
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
