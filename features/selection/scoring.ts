export type ScoredAnswer = { awardedPoints: number | null; maxPoints: number };

export function calculateSelectionScore(answers: ScoredAnswer[]): number | null {
  if (answers.length === 0 || answers.some((answer) => answer.awardedPoints === null)) return null;
  const maximum = answers.reduce((total, answer) => total + answer.maxPoints, 0);
  if (maximum <= 0) return null;
  const earned = answers.reduce((total, answer) => total + (answer.awardedPoints ?? 0), 0);
  return Math.round((earned / maximum) * 10000) / 100;
}

export function recommendedSelectionDecision(score: number | null, passingScore: number): "grading" | "passed" | "failed" {
  if (score === null) return "grading";
  return score >= passingScore ? "passed" : "failed";
}
