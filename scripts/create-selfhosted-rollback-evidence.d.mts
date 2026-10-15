export interface RollbackEvidenceArgs {
  target: "local" | "production";
  baselineRestore: string;
  rollbackRestore: string;
  probes: string;
  output: string;
}

export interface RestoreEvidence {
  sourcePath?: string;
  format: 1;
  evidenceSha256: string;
  backupName: string;
  preRestoreBackupName: string;
  restoredAt: string;
  backupSha256Sums: string;
  databaseProbe: 1;
}

export interface ReadonlyProbePhase {
  database: { readOnly: true; ok: true; marker: string };
  storage: { readOnly: true; ok: true; marker: string; sha256: string };
  readiness: { readOnly: true; method: "GET"; ok: true; statusCode: 200 };
}

export interface RollbackProbeManifest {
  schemaVersion: 1;
  kind: "selfhosted-rollback-readonly-probes";
  dataClass: "fixture" | "production-candidate";
  startedAt: string;
  finishedAt: string;
  baselineMarker: string;
  rollbackMarker: string;
  phases: { baseline: ReadonlyProbePhase; rollback: ReadonlyProbePhase };
}

export interface RollbackRehearsalEvidence {
  schemaVersion: 1;
  gate: "rollbackRehearsal";
  target: "local" | "production";
  dataClass: "fixture" | "production-candidate";
  claim: "isolated-fixture-rollback-rehearsed" | "production-candidate-rollback-rehearsed";
  productionRollbackClaimed: boolean;
  status: "PASS";
  startedAt: string;
  finishedAt: string;
  expiresAt: string;
  rtoSeconds: number;
  checks: {
    databaseMarker: { ok: boolean };
    storageMarker: { ok: boolean };
    readiness: { status: number };
  };
  restoreSequence: [RestoreEvidence, RestoreEvidence];
  markers: { baseline: string; rollback: string };
  probes: { baseline: ReadonlyProbePhase; rollback: ReadonlyProbePhase };
}

export function parseRollbackEvidenceArgs(args: string[]): RollbackEvidenceArgs;
export function parseRestoreEvidence(content: string, label?: string): RestoreEvidence;
export function createRollbackRehearsalEvidence(input: {
  target: "local" | "production";
  baselineRestore: RestoreEvidence;
  rollbackRestore: RestoreEvidence;
  probes: Record<string, any>;
}): RollbackRehearsalEvidence;
export function loadRollbackEvidenceInputs(config: RollbackEvidenceArgs): Promise<{
  baselineRestore: RestoreEvidence;
  rollbackRestore: RestoreEvidence;
  probes: RollbackProbeManifest;
}>;
export function writeRollbackRehearsalEvidence(report: RollbackRehearsalEvidence, output: string): Promise<{
  path: string;
  sizeBytes: number;
  sha256: string;
}>;
