export interface SourceArtifactDescriptor {
  path: string;
  sha256: string;
  observedAt: string;
}

export interface OperatorEvidenceManifest {
  schemaVersion: 1;
  target: "production";
  operator: string;
  reviewer: string;
  reviewedAt: string;
  monitoring: Record<"alertDelivery" | "errorRate" | "latency" | "capacity", SourceArtifactDescriptor>;
  writers: Array<{ name: string; state: "frozen" | "inactive"; artifact: SourceArtifactDescriptor }>;
  sourceWriteProbe: { blocked: true; artifact: SourceArtifactDescriptor };
  queueDrained: { pending: 0; artifact: SourceArtifactDescriptor };
}

export const REQUIRED_WRITERS: readonly string[];
export function parseOperatorEvidenceArgs(args: string[]): { help: true } | {
  input: string;
  monitoringOutput: string;
  writeFreezeOutput: string;
};
export function buildOperatorEvidence(manifest: OperatorEvidenceManifest, now?: Date): Promise<{
  monitoringReadiness: Record<string, unknown>;
  writeFreeze: Record<string, unknown>;
}>;
export function writeOperatorEvidence(reports: Awaited<ReturnType<typeof buildOperatorEvidence>>, outputs: {
  monitoringOutput: string;
  writeFreezeOutput: string;
}): Promise<Record<string, { path: string; sizeBytes: number; sha256: string }>>;
