export function effectiveAttemptStatus(
  attempt: { status: string; expires_at: string | null } | null | undefined,
  dueAt: string | null,
  availableUntil: string | null,
  now: number,
) {
  if (attempt?.status !== "in_progress") return attempt?.status;
  if (!attempt.expires_at || now >= Date.parse(attempt.expires_at) ||
      (dueAt && now >= Date.parse(dueAt)) ||
      (availableUntil && now >= Date.parse(availableUntil))) return "expired";
  return "in_progress";
}
