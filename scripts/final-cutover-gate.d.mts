export function verifyFinalCutover(
  options: { checklist: string; backupRoot: string },
  now?: Date,
  dataRoot?: string,
): Promise<{ status: "EVIDENCE_FILES_VALID_NOT_GO"; pilotSchoolId: string; artifactCount: number; reportCount: number; expiresAt: string }>;
