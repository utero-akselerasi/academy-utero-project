import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { verifyFinalCutover } from "../scripts/final-cutover-gate.mjs";

const gates = {
  maintenancePageReviewed: true, baselineReplay: true, stagingReadiness: true, smokeTest: true,
  productionPreflight: true, dataDeltaReconciled: true, developWriteFreezeVerified: true, productionWriteFreezeVerified: true,
  databaseBackupVerified: true, authBackupVerified: true, configBackupVerified: true, storageBackupVerified: true,
  restoreDrillPassed: true, rollbackDrillPassed: true, pilotSchoolApproved: true,
};

async function fixture() {
  const base = await mkdtemp(path.join(tmpdir(), "cutover-"));
  const backupRoot = path.join(base, "data", "run");
  await mkdir(backupRoot, { recursive: true });
  const artifacts = [];
  for (const kind of ["postgres", "auth", "config", "storage"]) {
    const file = path.join(backupRoot, `${kind}.backup`);
    const content = Buffer.from(`${kind}-backup`);
    await writeFile(file, content);
    artifacts.push({ kind, path: file, sizeBytes: content.length, capturedAt: "2026-10-12T14:05:00Z",
      sha256: createHash("sha256").update(content).digest("hex") });
  }
  const reports = [];
  const postgres = artifacts.find((artifact) => artifact.kind === "postgres")!;
  for (const kind of ["baselineReplay", "stagingReadiness", "smokeTest", "rollbackDrill", "productionWriteFreeze", "finalBackupRestore", "productionPreflight", "dataDeltaReconciled", "pilotSchool"]) {
    const file = path.join(backupRoot, `${kind}.json`);
    const report = {
      gate: kind, status: "PASS", exitCode: 0, command: `verify ${kind}`,
      startedAt: "2026-10-12T14:10:00Z", finishedAt: "2026-10-12T14:11:00Z",
      target: ["productionWriteFreeze", "finalBackupRestore", "productionPreflight", "dataDeltaReconciled", "pilotSchool"].includes(kind) ? "production" : "staging",
      operator: "operator-a", reviewer: "reviewer-b",
      ...(kind === "pilotSchool" ? { pilotSchoolId: "school-01" } : {}),
      ...(kind === "finalBackupRestore" ? { restoreVerified: true, backupSourcePath: postgres.path,
        backupSourceSha256: postgres.sha256 } : {}),
      ...(kind === "productionPreflight" ? { readOnly: true, syntheticBaseline: false, baselineStatus: "REVIEWED",
        baselineSource: "historical-production-clone", baselineSourcePath: "I:\\secure-evidence\\baseline.json",
        baselineSourceSha256: "a".repeat(64),
        baselineSha256: "b".repeat(64) } : {}),
    };
    const content = Buffer.from(JSON.stringify(report));
    await writeFile(file, content);
    reports.push({ kind, path: file, sizeBytes: content.length, sha256: createHash("sha256").update(content).digest("hex") });
  }
  const checklist = path.join(backupRoot, "checklist.json");
  const document = {
    target: "production", status: "EVIDENCE_READY", freezeAt: "2026-10-12T14:00:00Z", expiresAt: "2026-10-12T16:00:00Z",
    pilotSchoolId: "school-01", rollbackCommand: "docker compose -p academy-replacement up -d", gates: { ...gates }, artifacts, reports,
  };
  await writeFile(checklist, JSON.stringify(document));
  return { backupRoot, checklist, document };
}

describe("final cutover gate", () => {
  it("fails closed when backup root is not /data", async () => {
    const value = await fixture();
    await expect(verifyFinalCutover(value, new Date("2026-10-12T15:00:00Z"))).rejects.toThrow("/data");
  });

  it("rejects missing gate before artifact acceptance", async () => {
    const value = await fixture();
    value.document.gates.pilotSchoolApproved = false;
    await writeFile(value.checklist, JSON.stringify(value.document));
    await expect(verifyFinalCutover(value, new Date("2026-10-12T15:00:00Z"), path.dirname(value.backupRoot))).rejects.toThrow("pilotSchoolApproved");
  });

  it("rejects destructive rollback commands", async () => {
    const value = await fixture();
    value.document.rollbackCommand = "rm -rf /data/production restore replacement";
    await writeFile(value.checklist, JSON.stringify(value.document));
    await expect(verifyFinalCutover(value, new Date("2026-10-12T15:00:00Z"), path.dirname(value.backupRoot))).rejects.toThrow("destruktif");
    value.document.rollbackCommand = "docker compose -p academy-replacement down -v";
    await writeFile(value.checklist, JSON.stringify(value.document));
    await expect(verifyFinalCutover(value, new Date("2026-10-12T15:00:00Z"), path.dirname(value.backupRoot))).rejects.toThrow("destruktif");
  });

  it("rejects checklist di luar backup root", async () => {
    const value = await fixture();
    value.checklist = path.join(path.dirname(value.backupRoot), "external-checklist.json");
    await writeFile(value.checklist, JSON.stringify(value.document));
    await expect(verifyFinalCutover(value, new Date("2026-10-12T15:00:00Z"), path.dirname(value.backupRoot)))
      .rejects.toThrow("backup root");
  });

  it("accepts complete, current, hash-verified evidence", async () => {
    const value = await fixture();
    await expect(verifyFinalCutover(value, new Date("2026-10-12T15:00:00Z"), path.dirname(value.backupRoot)))
      .resolves.toMatchObject({ status: "EVIDENCE_FILES_VALID_NOT_GO", pilotSchoolId: "school-01", artifactCount: 4, reportCount: 9 });
  });

  it("rejects missing mandatory preflight report", async () => {
    const value = await fixture();
    value.document.reports = value.document.reports.filter((report) => report.kind !== "productionPreflight");
    await writeFile(value.checklist, JSON.stringify(value.document));
    await expect(verifyFinalCutover(value, new Date("2026-10-12T15:00:00Z"), path.dirname(value.backupRoot)))
      .rejects.toThrow("productionPreflight");
  });

  it("rejects self-approved or failed reports", async () => {
    const value = await fixture();
    const entry = value.document.reports.find((report) => report.kind === "smokeTest")!;
    const report = JSON.parse(await readFile(entry.path, "utf8"));
    report.reviewer = report.operator;
    const content = Buffer.from(JSON.stringify(report));
    await writeFile(entry.path, content);
    entry.sizeBytes = content.length;
    entry.sha256 = createHash("sha256").update(content).digest("hex");
    await writeFile(value.checklist, JSON.stringify(value.document));
    await expect(verifyFinalCutover(value, new Date("2026-10-12T15:00:00Z"), path.dirname(value.backupRoot)))
      .rejects.toThrow("direview");
  });

  it("rejects backup dan bukti production di luar write freeze", async () => {
    const value = await fixture();
    value.document.artifacts[0].capturedAt = "2026-10-12T13:59:59Z";
    await writeFile(value.checklist, JSON.stringify(value.document));
    await expect(verifyFinalCutover(value, new Date("2026-10-12T15:00:00Z"), path.dirname(value.backupRoot)))
      .rejects.toThrow("backup final");

    value.document.artifacts[0].capturedAt = "2026-10-12T14:05:00Z";
    const entry = value.document.reports.find((report) => report.kind === "productionPreflight")!;
    const report = JSON.parse(await readFile(entry.path, "utf8"));
    report.startedAt = "2026-10-12T13:59:59Z";
    const content = Buffer.from(JSON.stringify(report));
    await writeFile(entry.path, content);
    entry.sizeBytes = content.length;
    entry.sha256 = createHash("sha256").update(content).digest("hex");
    await writeFile(value.checklist, JSON.stringify(value.document));
    await expect(verifyFinalCutover(value, new Date("2026-10-12T15:00:00Z"), path.dirname(value.backupRoot)))
      .rejects.toThrow("window write freeze");
  });

  it("rejects production preflight tanpa baseline clone reviewed dan read-only", async () => {
    const value = await fixture();
    const entry = value.document.reports.find((report) => report.kind === "productionPreflight")!;
    const report = JSON.parse(await readFile(entry.path, "utf8"));
    report.syntheticBaseline = true;
    const content = Buffer.from(JSON.stringify(report));
    await writeFile(entry.path, content);
    entry.sizeBytes = content.length;
    entry.sha256 = createHash("sha256").update(content).digest("hex");
    await writeFile(value.checklist, JSON.stringify(value.document));
    await expect(verifyFinalCutover(value, new Date("2026-10-12T15:00:00Z"), path.dirname(value.backupRoot)))
      .rejects.toThrow("baseline reviewed");
  });

  it("rejects restore drill yang tidak terikat backup PostgreSQL final", async () => {
    const value = await fixture();
    const entry = value.document.reports.find((report) => report.kind === "finalBackupRestore")!;
    const report = JSON.parse(await readFile(entry.path, "utf8"));
    report.backupSourceSha256 = "f".repeat(64);
    const content = Buffer.from(JSON.stringify(report));
    await writeFile(entry.path, content);
    entry.sizeBytes = content.length;
    entry.sha256 = createHash("sha256").update(content).digest("hex");
    await writeFile(value.checklist, JSON.stringify(value.document));
    await expect(verifyFinalCutover(value, new Date("2026-10-12T15:00:00Z"), path.dirname(value.backupRoot)))
      .rejects.toThrow("backup PostgreSQL final");
  });
});
