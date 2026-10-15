import { readFile, stat, writeFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createRollbackRehearsalEvidence,
  parseRestoreEvidence,
  parseRollbackEvidenceArgs,
  writeRollbackRehearsalEvidence,
} from "../scripts/create-selfhosted-rollback-evidence.mjs";
import { validateEvidenceReport } from "../scripts/evaluate-selfhosted-uat-gate.mjs";

const hash = "a".repeat(64);
const restore = (backupName: string, restoredAt: string) => parseRestoreEvidence([
  "RESTORE_EVIDENCE_FORMAT=1",
  `BACKUP_NAME=${backupName}`,
  `PRE_RESTORE_BACKUP_NAME=pre-${backupName}`,
  `RESTORED_AT_UTC=${restoredAt}`,
  `BACKUP_SHA256SUMS=${hash}`,
  "DATABASE_PROBE=1",
  "",
].join("\n"));

const probes = {
  schemaVersion: 1,
  kind: "selfhosted-rollback-readonly-probes",
  dataClass: "fixture",
  startedAt: "2026-10-15T06:00:00Z",
  finishedAt: "2026-10-15T06:02:30Z",
  baselineMarker: "baseline-origin",
  rollbackMarker: "rollback-origin",
  phases: {
    baseline: {
      database: { readOnly: true, ok: true, marker: "baseline-origin" },
      storage: { readOnly: true, ok: true, marker: "baseline-origin", sha256: hash },
      readiness: { readOnly: true, method: "GET", ok: true, statusCode: 200 },
    },
    rollback: {
      database: { readOnly: true, ok: true, marker: "rollback-origin" },
      storage: { readOnly: true, ok: true, marker: "rollback-origin", sha256: hash },
      readiness: { readOnly: true, method: "GET", ok: true, statusCode: 200 },
    },
  },
};

const baselineRestore = restore("baseline", "20261015T060030Z");
const rollbackRestore = restore("rollback", "20261015T060200Z");

describe("create self-hosted rollback rehearsal evidence", () => {
  it("default local dan production wajib konfirmasi eksplisit", () => {
    const root = path.resolve(tmpdir(), "rollback-evidence");
    const common = ["--baseline-restore", path.join(root, "baseline.env"), "--rollback-restore", path.join(root, "rollback.env"),
      "--probes", path.join(root, "probes.json"), "--output", path.join(root, "evidence.json")];
    expect(parseRollbackEvidenceArgs(common).target).toBe("local");
    expect(() => parseRollbackEvidenceArgs([...common, "--target", "production"])).toThrow("--confirm");
    expect(parseRollbackEvidenceArgs([...common, "--target", "production", "--confirm", "production-candidate-rollback-rehearsal"]).target).toBe("production");
  });

  it("menghasilkan evidence fixture tanpa klaim rollback production dan RTO terukur", () => {
    expect(createRollbackRehearsalEvidence({ target: "local", baselineRestore, rollbackRestore, probes })).toMatchObject({
      gate: "rollbackRehearsal",
      status: "PASS",
      claim: "isolated-fixture-rollback-rehearsed",
      productionRollbackClaimed: false,
      rtoSeconds: 150,
    });
  });

  it("menerima production candidate hanya pada target production eksplisit", () => {
    const report = createRollbackRehearsalEvidence({ target: "production", baselineRestore, rollbackRestore,
      probes: { ...probes, dataClass: "production-candidate" } });
    expect(report).toMatchObject({ claim: "production-candidate-rollback-rehearsed", productionRollbackClaimed: true });
    expect(validateEvidenceReport("rollbackRehearsal", report as unknown as Record<string, unknown>)).toBe(true);
    expect(Date.parse(report.expiresAt) - Date.parse(report.finishedAt)).toBe(24 * 60 * 60 * 1000);
    expect(() => createRollbackRehearsalEvidence({ target: "production", baselineRestore, rollbackRestore, probes }))
      .toThrow("Fixture");
  });

  it("fail-closed untuk restore, urutan timestamp, marker, dan probe non-read-only", () => {
    expect(() => parseRestoreEvidence("RESTORE_EVIDENCE_FORMAT=1\n")).toThrow("tidak lengkap");
    expect(() => createRollbackRehearsalEvidence({ target: "local", baselineRestore, rollbackRestore,
      probes: { ...probes, finishedAt: "2026-10-15T06:01:00Z" } })).toThrow("timestamp");
    expect(() => createRollbackRehearsalEvidence({ target: "local", baselineRestore, rollbackRestore,
      probes: { ...probes, phases: { ...probes.phases, rollback: {
        ...probes.phases.rollback, database: { ...probes.phases.rollback.database, readOnly: false },
      } } } })).toThrow("read-only");
  });

  it("menerbitkan JSON atomik, mode privat, hash cocok, dan tidak menimpa", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "academy-rollback-evidence-"));
    const output = path.join(directory, "evidence.json");
    const report = createRollbackRehearsalEvidence({ target: "local", baselineRestore, rollbackRestore, probes });
    const artifact = await writeRollbackRehearsalEvidence(report, output);
    const content = await readFile(output, "utf8");
    expect(artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect((await stat(output)).size).toBe(artifact.sizeBytes);
    expect(JSON.parse(content)).toMatchObject({ status: "PASS", productionRollbackClaimed: false });
    await expect(writeRollbackRehearsalEvidence(report, output)).rejects.toThrow();
    await writeFile(path.join(directory, "unrelated"), "kept");
  });
});
