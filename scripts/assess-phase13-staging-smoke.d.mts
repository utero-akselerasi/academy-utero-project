export const REQUIRED_BUCKETS: readonly string[];
export const EXPECTED_LATEST_MIGRATION: "0052";
export function assessStagingSmoke(evidence: Record<string, unknown>): {
  status: "EVIDENCE_CLAIMED_NOT_VERIFIED" | "NO-GO";
  gates: Record<string, boolean>;
  blockers: string[];
  fixtureAllowed: boolean;
  smokeAllowed: boolean;
  e2e: Record<string, unknown>;
};
