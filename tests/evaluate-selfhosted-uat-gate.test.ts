import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateSelfhostedUatGate, REQUIRED_UAT_EVIDENCE } from "../scripts/evaluate-selfhosted-uat-gate.mjs";

const roles = ["super_admin", "admin", "school", "intern", "applicant"];
const sourceContent = "verified operator log\n";
const sourceArtifact = { path: path.join(tmpdir(), `academy-operator-source-${process.pid}.log`),
  sha256: createHash("sha256").update(sourceContent).digest("hex"), sizeBytes: Buffer.byteLength(sourceContent),
  observedAt: "2026-10-15T08:55:00Z" };

function semanticEvidence(kind: string) {
  const common = { gate: kind, target: "production", status: "PASS",
    finishedAt: "2026-10-15T09:00:00Z", expiresAt: "2026-10-16T09:00:00Z" };
  const values: Record<string, object> = {
    identityOnlyMigration: { checks: Object.fromEntries(["profileCount", "profileChecksum", "emailIdentities", "noPasswordHashes",
      "noConfirmedEmails", "noSessions", "noRoleAssignments", "noDomainRows", "noStorageObjects", "avatarsCleared"].map((name) => [name, true])),
      counts: { sourceProfiles: 29, targetProfiles: 29, users: 29, profiles: 29, identities: 29, emailIdentities: 29,
        passwordHashes: 0, confirmedEmails: 0, sessions: 0,
        roleAssignments: 0, domainRows: 0, storageObjects: 0 },
      checksums: { sourceProfiles: "a".repeat(64), targetProfiles: "a".repeat(64) } },
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
  const root = await mkdtemp(path.join(tmpdir(), "academy-uat-gate-"));
  await writeFile(sourceArtifact.path, sourceContent);
  const evidence = [];
  for (const kind of REQUIRED_UAT_EVIDENCE) {
    const file = path.join(root, `${kind}.json`);
    const content = Buffer.from(JSON.stringify(semanticEvidence(kind)));
    await writeFile(file, content);
    evidence.push({ kind, path: file, sizeBytes: content.length, sha256: createHash("sha256").update(content).digest("hex") });
  }
  const checklist = path.join(root, "checklist.json");
  const document = { schemaVersion: 1, target: "production", operator: "operator-a", reviewer: "reviewer-b",
    expiresAt: "2026-10-16T09:00:00Z", evidence };
  await writeFile(checklist, JSON.stringify(document));
  return { checklist, document };
}

describe("self-hosted UAT gate", () => {
  it("menghasilkan GO hanya untuk bukti lengkap dan valid", async () => {
    const value = await fixture();
    await expect(evaluateSelfhostedUatGate(value.checklist, new Date("2026-10-15T10:00:00Z")))
      .resolves.toMatchObject({ decision: "GO", evidenceCount: REQUIRED_UAT_EVIDENCE.length });
  });

  it("fail closed saat evidence hilang", async () => {
    const value = await fixture();
    value.document.evidence.pop();
    await writeFile(value.checklist, JSON.stringify(value.document));
    await expect(evaluateSelfhostedUatGate(value.checklist, new Date("2026-10-15T10:00:00Z"))).rejects.toThrow("wajib tepat satu");
  });

  it("menolak monitoringReadiness sebagai pengganti opsHealth", async () => {
    const value = await fixture();
    const health = value.document.evidence.find((entry) => entry.kind === "opsHealth")!;
    const content = Buffer.from(JSON.stringify({ gate: "monitoringReadiness", target: "production", status: "PASS",
      finishedAt: "2026-10-15T09:00:00Z", expiresAt: "2026-10-16T09:00:00Z" }));
    await writeFile(health.path, content);
    health.sizeBytes = content.length;
    health.sha256 = createHash("sha256").update(content).digest("hex");
    await writeFile(value.checklist, JSON.stringify(value.document));
    await expect(evaluateSelfhostedUatGate(value.checklist, new Date("2026-10-15T10:00:00Z")))
      .rejects.toThrow("Evidence opsHealth bukan PASS production yang sesuai");
  });

  it("menolak evidence PASS yang kosong secara semantik", async () => {
    const value = await fixture();
    const evidence = value.document.evidence.find((entry) => entry.kind === "identityOnlyMigration")!;
    const content = Buffer.from(JSON.stringify({ gate: evidence.kind, target: "production", status: "PASS",
      finishedAt: "2026-10-15T09:00:00Z", expiresAt: "2026-10-16T09:00:00Z" }));
    await writeFile(evidence.path, content);
    evidence.sizeBytes = content.length;
    evidence.sha256 = createHash("sha256").update(content).digest("hex");
    await writeFile(value.checklist, JSON.stringify(value.document));
    await expect(evaluateSelfhostedUatGate(value.checklist, new Date("2026-10-15T10:00:00Z")))
      .rejects.toThrow("Evidence identityOnlyMigration tidak lengkap");
  });

  it("menolak health report dengan masa berlaku diperpanjang lewat checklist", async () => {
    const value = await fixture();
    const evidence = value.document.evidence.find((entry) => entry.kind === "opsHealth")!;
    const report = semanticEvidence("opsHealth");
    report.expiresAt = "2026-10-16T09:00:00Z";
    const content = Buffer.from(JSON.stringify(report));
    await writeFile(evidence.path, content);
    evidence.sizeBytes = content.length;
    evidence.sha256 = createHash("sha256").update(content).digest("hex");
    await writeFile(value.checklist, JSON.stringify(value.document));
    await expect(evaluateSelfhostedUatGate(value.checklist, new Date("2026-10-15T10:00:00Z")))
      .rejects.toThrow("Evidence opsHealth kedaluwarsa");
  });

  it("menolak hash berubah dan self-review", async () => {
    const value = await fixture();
    await writeFile(value.document.evidence[0].path, "tampered");
    await expect(evaluateSelfhostedUatGate(value.checklist, new Date("2026-10-15T10:00:00Z"))).rejects.toThrow(/Ukuran|SHA-256/);

    const second = await fixture();
    second.document.reviewer = second.document.operator;
    await writeFile(second.checklist, JSON.stringify(second.document));
    await expect(evaluateSelfhostedUatGate(second.checklist, new Date("2026-10-15T10:00:00Z"))).rejects.toThrow("wajib berbeda");

    const differentCase = await fixture();
    differentCase.document.reviewer = "Operator-A";
    await writeFile(differentCase.checklist, JSON.stringify(differentCase.document));
    await expect(evaluateSelfhostedUatGate(differentCase.checklist, new Date("2026-10-15T10:00:00Z"))).rejects.toThrow("wajib berbeda");
  });

  it("menolak evidence operator tanpa artifact, blocked, pending, atau state", async () => {
    for (const kind of ["monitoringReadiness", "writeFreeze"] as const) {
      const value = await fixture();
      const evidence = value.document.evidence.find((entry) => entry.kind === kind)!;
      const report = semanticEvidence(kind) as ReturnType<typeof semanticEvidence> & {
        checks: Record<string, { sourceArtifact?: typeof sourceArtifact; blocked?: boolean; pending?: number }>;
        writers: Array<{ state?: string }>;
      };
      const checks = report.checks;
      if (kind === "monitoringReadiness") delete checks.alertDelivery.sourceArtifact;
      else {
        delete report.writers[0].state;
        checks.sourceWriteProbe.blocked = false;
        checks.queueDrained.pending = 1;
      }
      const content = Buffer.from(JSON.stringify(report));
      await writeFile(evidence.path, content);
      evidence.sizeBytes = content.length;
      evidence.sha256 = createHash("sha256").update(content).digest("hex");
      await writeFile(value.checklist, JSON.stringify(value.document));
      await expect(evaluateSelfhostedUatGate(value.checklist, new Date("2026-10-15T10:00:00Z")))
        .rejects.toThrow(`Evidence ${kind} tidak lengkap`);
    }
  });

  it("menolak source artifact berubah setelah review", async () => {
    const value = await fixture();
    const evidence = value.document.evidence.find((entry) => entry.kind === "monitoringReadiness")!;
    const report = semanticEvidence("monitoringReadiness") as ReturnType<typeof semanticEvidence> & {
      checks: Record<string, { sourceArtifact: typeof sourceArtifact }>;
    };
    const tamperedSource = path.join(path.dirname(value.checklist), "tampered-operator.log");
    await writeFile(tamperedSource, "different log\n");
    report.checks.alertDelivery.sourceArtifact = { ...sourceArtifact, path: tamperedSource };
    const content = Buffer.from(JSON.stringify(report));
    await writeFile(evidence.path, content);
    evidence.sizeBytes = content.length;
    evidence.sha256 = createHash("sha256").update(content).digest("hex");
    await writeFile(value.checklist, JSON.stringify(value.document));
    await expect(evaluateSelfhostedUatGate(value.checklist, new Date("2026-10-15T10:00:00Z")))
      .rejects.toThrow("source artifact berubah");
  });

  it("menolak hasil probe lokal meski statusnya PASS", async () => {
    const value = await fixture();
    const evidence = value.document.evidence.find((entry) => entry.kind === "readonlyUatPerformance")!;
    const content = Buffer.from(JSON.stringify({ gate: evidence.kind, target: "local", status: "PASS",
      finishedAt: "2026-10-15T09:00:00Z", expiresAt: "2026-10-16T09:00:00Z" }));
    await writeFile(evidence.path, content);
    evidence.sizeBytes = content.length;
    evidence.sha256 = createHash("sha256").update(content).digest("hex");
    await writeFile(value.checklist, JSON.stringify(value.document));
    await expect(evaluateSelfhostedUatGate(value.checklist, new Date("2026-10-15T10:00:00Z")))
      .rejects.toThrow("bukan PASS production");
  });
});
