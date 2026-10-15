const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validId(value) {
  return typeof value === "string" && UUID.test(value);
}

export function parseAssessment(body) {
  if (!body || !["draft", "finalize"].includes(body.submitType)) return null;
  if (body.finalScore === null || body.finalScore === "" || typeof body.finalScore === "boolean") return null;
  const finalScore = Number(body.finalScore);
  if (!Number.isFinite(finalScore) || finalScore < 0 || finalScore > 100) return null;
  if (!body.score || typeof body.score !== "object" || Array.isArray(body.score)) return null;
  const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
  if (feedback.length > 5000) return null;
  return { score: body.score, finalScore, feedback: feedback || null, submitType: body.submitType };
}
