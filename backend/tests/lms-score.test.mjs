import assert from "node:assert/strict";
import test from "node:test";
import { scoreQuiz } from "../src/lms/score.mjs";

test("scoreQuiz accepts canonical answer text", () => {
  const result = scoreQuiz([{ id: "q1", options: ["A", "B"], correct_answer: "B" }], { q1: "B" });
  assert.equal(result.score, 100);
  assert.deepEqual(result.answers, [{ question_id: "q1", selected_option: "B" }]);
});

test("scoreQuiz accepts legacy numeric answer key and ignores broken keys", () => {
  const result = scoreQuiz([
    { id: 1, options: ["A", "B"], answer: 1 },
    { id: 2, options: ["A"], answer: 8 },
  ], { 1: "B", 2: "A" });
  assert.equal(result.score, 100);
});

test("scoreQuiz never trusts client-provided score", () => {
  const result = scoreQuiz([{ id: "q1", options: ["A", "B"], correct_answer: "A" }], { q1: "B", score: "100" });
  assert.equal(result.score, 0);
});
