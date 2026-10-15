import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildSelfhostedUatChecklist } from "../scripts/build-selfhosted-uat-checklist.mjs";
import { REQUIRED_UAT_EVIDENCE } from "../scripts/evaluate-selfhosted-uat-gate.mjs";

const roles = ["super_admin", "admin", "school", "intern", "applicant"];
const sourceContent = "verified operator log\n";
const sourceArtifact = { path: path.join(tmpdir(), `academy-builder-source-${process.pid}.log`),
  sha256: createHash("sha256").update(sourceContent).digest("hex"), sizeBytes: Buffer.byteLength(sourceContent),
  observedAt: "2026-10-15T08:55:00Z" };

function semanticEvidence(kind: string) {
  const common = { gate: kind, target: "production", status: "PASS",
    finishedAt: "2026-10-15T09:00:00Z", expiresAt: "2026-10-16T09:00:00Z" };
  const values: Record<string, object> = {
    migrationVerification: { failures: [], tableCount: 76, foreignKeysChecked: 278 },
    storageVerification: { failures: [], storageObjects: 3, storageBytesChecked: 3 },
    rbacVerification: { roles, permissionMismatchCount: 0, orphanAssignmentCount: 0 },
    roleSmoke: { anonymousStatus: 401, negativeChecks: 4, secureCookies: 5, results: roles.map((role) => ({ role, status: 200,
      forbiddenEndpoint: role === "super_admin" ? null : "/v1/super-admin/diagnostics", forbiddenStatus: role === "super_admin" ? null : 403 })) },
    readonlyUatPerformance: { limits: { requests: 20, maxErrorRate: 0, p95BudgetMs: 1500 }, result: { completed: 20, errorRate: 0, p95Ms: 25 } },
    backupRestore: { checks: { database: { ok: true }, storage: { ok: true }, safetyBackup: { ok: true } } },
    rollbackRehearsal: { rtoSeconds: 60, checks: { databaseMarker: { ok: true }, storageMarker: { ok: true }, readiness: { status: 200 } } },
    tlsPreflight: { checks: { tls: { ok: true }, httpRedirect: { ok: true }, health: { ok: true }, securityHeaders: { ok: true } } },
    smtpSmoke: { checks: { configuration: { ok: true }, tlsAndAuthentication: { ok: true }, delivery: { ok: true } } },
    opsHealth: { checks: Object.fromEntries(["api", "database", "storageDisk", "backupDisk", "offsiteDisk", "backupFreshness", "offsiteBackupFreshness", "offsiteIsolation"].map((name) => [name, { ok: true }])) },
    monitoringReadiness: { operator: "operator-a", reviewer: "reviewer-b",
      checks: Object.fromEntries(["alertDelivery", "errorRate", "latency", "capacity"]
      .map((name) => [name, { ok: true, sourceArtifact }])) },
    writeFreeze: { operator: "operator-a", reviewer: "reviewer-b",
      writers: ["web", "api", "scheduled-jobs", "edge-functions", "webhooks", "legacy-clients", "direct-uploads"]
      .map((name) => ({ name, state: "frozen", frozen: true, sourceArtifact })),
      checks: { sourceWriteProbe: { ok: true, blocked: true, sourceArtifact },
        queueDrained: { ok: true, pending: 0, sourceArtifact } } },
  };
  if (kind === "opsHealth") {
    common.finishedAt = "2026-10-15T09:56:00Z";
    common.expiresAt = "2026-10-15T10:05:00Z";
  }
  return { ...common, ...values[kind] };
}

async function fixture() {
  const evidenceDir = await mkdtemp(path.join(tmpdir(), "academy-uat-builder-"));
  await writeFile(sourceArtifact.path, sourceContent);
  for (const kind of REQUIRED_UAT_EVIDENCE) await writeFile(path.join(evidenceDir, `${kind}.json`), JSON.stringify(semanticEvidence(kind)));
  return { evidenceDir, output: path.join(evidenceDir, "uat-checklist.json") };
}

describe("self-hosted UAT checklist builder", () => {
  it("membangun checklist terurut, tervalidasi GO, dan mode 0600", async () => {
    const value = await fixture();
    const result = await buildSelfhostedUatChecklist({ ...value, operator: "operator-a", reviewer: "reviewer-b" },
      new Date("2026-10-15T10:00:00Z"));
    const document = JSON.parse(await readFile(value.output, "utf8"));
    expect(result.decision).toMatchObject({ decision: "GO", evidenceCount: REQUIRED_UAT_EVIDENCE.length });
    expect(document.evidence.map((entry: { kind: string }) => entry.kind)).toEqual(REQUIRED_UAT_EVIDENCE);
    expect(document.evidence.every((entry: { path: string; sizeBytes: number; sha256: string }) =>
      path.isAbsolute(entry.path) && entry.sizeBytes > 0 && /^[a-f0-9]{64}$/.test(entry.sha256))).toBe(true);
    if (process.platform !== "win32") expect((await lstat(value.output)).mode & 0o777).toBe(0o600);
  });

  it("menolak self-review dan tidak menerbitkan output", async () => {
    const value = await fixture();
    await expect(buildSelfhostedUatChecklist({ ...value, operator: "same", reviewer: "same" },
      new Date("2026-10-15T10:00:00Z"))).rejects.toThrow("wajib berbeda");
    await expect(lstat(value.output)).rejects.toThrow();

    const caseVariant = await fixture();
    await expect(buildSelfhostedUatChecklist({ ...caseVariant, operator: "Operator-A", reviewer: "operator-a" },
      new Date("2026-10-15T10:00:00Z"))).rejects.toThrow("wajib berbeda");
    await expect(lstat(caseVariant.output)).rejects.toThrow();
  });

  it("menolak gate duplikat atau evidence tambahan", async () => {
    const duplicate = await fixture();
    await writeFile(path.join(duplicate.evidenceDir, "storageVerification.json"), JSON.stringify(semanticEvidence("migrationVerification")));
    await expect(buildSelfhostedUatChecklist({ ...duplicate, operator: "operator-a", reviewer: "reviewer-b" },
      new Date("2026-10-15T10:00:00Z"))).rejects.toThrow("Gate evidence migrationVerification wajib unik");

    const knownManifest = await fixture();
    await writeFile(path.join(knownManifest.evidenceDir, "operator-review.json"), "{}");
    await expect(buildSelfhostedUatChecklist({ ...knownManifest, operator: "operator-a", reviewer: "reviewer-b" },
      new Date("2026-10-15T10:00:00Z"))).resolves.toMatchObject({
        decision: { decision: "GO", evidenceCount: REQUIRED_UAT_EVIDENCE.length },
      });

    const unknownJson = await fixture();
    await writeFile(path.join(unknownJson.evidenceDir, "extra.json"), "{}");
    await expect(buildSelfhostedUatChecklist({ ...unknownJson, operator: "operator-a", reviewer: "reviewer-b" },
      new Date("2026-10-15T10:00:00Z"))).rejects.toThrow("wajib tepat 12");
  });

  it("menolak symlink dan evidence yang gagal evaluator sebelum rename", async () => {
    const linked = await fixture();
    const link = path.join(linked.evidenceDir, "migrationVerification.json");
    const linkTarget = path.join(linked.evidenceDir, "linked-evidence");
    await unlink(link);
    await mkdir(linkTarget);
    await symlink(linkTarget, link, "junction");
    await expect(buildSelfhostedUatChecklist({ ...linked, operator: "operator-a", reviewer: "reviewer-b" },
      new Date("2026-10-15T10:00:00Z"))).rejects.toThrow("wajib file biasa non-symlink");

    const invalid = await fixture();
    const report = semanticEvidence("readonlyUatPerformance");
    report.status = "FAIL";
    await writeFile(path.join(invalid.evidenceDir, "readonlyUatPerformance.json"), JSON.stringify(report));
    await expect(buildSelfhostedUatChecklist({ ...invalid, operator: "operator-a", reviewer: "reviewer-b" },
      new Date("2026-10-15T10:00:00Z"))).rejects.toThrow("bukan PASS production");
    await expect(lstat(invalid.output)).rejects.toThrow();
  });
});
