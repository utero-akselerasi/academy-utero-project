export const REQUIRED_UAT_EVIDENCE: readonly string[];

export interface UatGateDecision {
  decision: "GO";
  target: "production";
  evidenceCount: number;
  evaluatedAt: string;
  note: string;
}

export function validateEvidenceReport(kind: string, report: Record<string, unknown>): true;

export function evaluateSelfhostedUatGate(checklistPath: string, now?: Date): Promise<UatGateDecision>;
