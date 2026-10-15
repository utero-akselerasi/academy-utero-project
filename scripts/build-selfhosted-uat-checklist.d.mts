import type { UatGateDecision } from "./evaluate-selfhosted-uat-gate.mjs";

export interface BuildSelfhostedUatChecklistOptions {
  evidenceDir: string;
  operator: string;
  reviewer: string;
  output: string;
}

export interface UatChecklistEvidence {
  kind: string;
  path: string;
  sizeBytes: number;
  sha256: string;
}

export interface SelfhostedUatChecklist {
  schemaVersion: 1;
  target: "production";
  operator: string;
  reviewer: string;
  evidence: UatChecklistEvidence[];
}

export function buildSelfhostedUatChecklist(
  options: BuildSelfhostedUatChecklistOptions,
  now?: Date,
): Promise<{ output: string; checklist: SelfhostedUatChecklist; decision: UatGateDecision }>;
