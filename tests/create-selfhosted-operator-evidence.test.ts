import { createHash } from "node:crypto";
import { lstat, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOperatorEvidence, parseOperatorEvidenceArgs, REQUIRED_WRITERS,
  writeOperatorEvidence } from "../scripts/create-selfhosted-operator-evidence.mjs";
import type { OperatorEvidenceManifest } from "../scripts/create-selfhosted-operator-evidence.mjs";
import { validateEvidenceReport } from "../scripts/evaluate-selfhosted-uat-gate.mjs";

const now = new Date("2026-10-15T10:00:00.000Z");

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "academy-operator-evidence-"));
  async function artifact(name: string) {
    const file = path.join(root, `${name}.log`);
    const content = Buffer.from(`${name}: verified production evidence\n`);
    await writeFile(file, content);
    return { path: file, sha256: createHash("sha256").update(content).digest("hex"), observedAt: "2026-10-15T09:30:00.000Z" };
  }
  const monitoring = Object.fromEntries(await Promise.all(["alertDelivery", "errorRate", "latency", "capacity"]
    .map(async (name) => [name, await artifact(name)])));
  const writers = await Promise.all(REQUIRED_WRITERS.map(async (name, index) => ({ name,
    state: (index === 6 ? "inactive" : "frozen") as "inactive" | "frozen", artifact: await artifact(`writer-${name}`) })));
  const manifest: OperatorEvidenceManifest = { schemaVersion: 1, target: "production", operator: "operator-a", reviewer: "reviewer-b",
    reviewedAt: "2026-10-15T09:45:00.000Z", monitoring, writers,
    sourceWriteProbe: { blocked: true, artifact: await artifact("source-write-probe") },
    queueDrained: { pending: 0, artifact: await artifact("queue-drained") } };
  return { root, manifest };
}

describe("self-hosted operator evidence", () => {
  it("menerima hanya tiga path absolut yang berbeda", () => {
    const input = path.join(tmpdir(), "input.json");
    const monitoringOutput = path.join(tmpdir(), "monitoring.json");
    const writeFreezeOutput = path.join(tmpdir(), "freeze.json");
    expect(parseOperatorEvidenceArgs(["--input", input, "--monitoring-output", monitoringOutput,
      "--write-freeze-output", writeFreezeOutput])).toEqual({ input, monitoringOutput, writeFreezeOutput });
    expect(() => parseOperatorEvidenceArgs(["--input", "relative.json", "--monitoring-output", monitoringOutput,
      "--write-freeze-output", writeFreezeOutput])).toThrow();
  });

  it("membuat dua JSON PASS yang kompatibel evaluator", async () => {
    const value = await fixture();
    const reports = await buildOperatorEvidence(value.manifest, now);
    expect(reports.monitoringReadiness).toMatchObject({ gate: "monitoringReadiness", target: "production", status: "PASS",
      checks: { alertDelivery: { ok: true }, errorRate: { ok: true }, latency: { ok: true }, capacity: { ok: true } } });
    expect(reports.writeFreeze).toMatchObject({ gate: "writeFreeze", target: "production", status: "PASS",
      checks: { sourceWriteProbe: { ok: true }, queueDrained: { ok: true } } });
    expect((reports.writeFreeze.writers as Array<{ frozen: boolean }>).every((writer) => writer.frozen)).toBe(true);
    expect(validateEvidenceReport("monitoringReadiness", reports.monitoringReadiness)).toBe(true);
    expect(validateEvidenceReport("writeFreeze", reports.writeFreeze)).toBe(true);
  });

  it("fail closed untuk self-review, hash salah, timestamp lama, dan writer hilang", async () => {
    const selfReview = await fixture();
    selfReview.manifest.reviewer = selfReview.manifest.operator;
    await expect(buildOperatorEvidence(selfReview.manifest, now)).rejects.toThrow("wajib berbeda");
    const badHash = await fixture();
    badHash.manifest.monitoring.alertDelivery.sha256 = "0".repeat(64);
    await expect(buildOperatorEvidence(badHash.manifest, now)).rejects.toThrow("SHA-256");
    const stale = await fixture();
    stale.manifest.monitoring.latency.observedAt = "2026-10-14T09:59:59.000Z";
    await expect(buildOperatorEvidence(stale.manifest, now)).rejects.toThrow("lebih tua");
    const invalidCalendar = await fixture();
    invalidCalendar.manifest.monitoring.latency.observedAt = "2026-02-31T09:30:00.000Z";
    await expect(buildOperatorEvidence(invalidCalendar.manifest, now)).rejects.toThrow("tanggal kalender");
    const reviewBeforeObservation = await fixture();
    reviewBeforeObservation.manifest.reviewedAt = "2026-10-15T09:29:59.000Z";
    await expect(buildOperatorEvidence(reviewBeforeObservation.manifest, now)).rejects.toThrow("setelah seluruh observedAt");
    const missing = await fixture();
    missing.manifest.writers.pop();
    await expect(buildOperatorEvidence(missing.manifest, now)).rejects.toThrow("Tepat tujuh writer");
  });

  it.skipIf(process.platform === "win32")("menolak source symlink", async () => {
    const value = await fixture();
    const link = path.join(value.root, "alert-link.log");
    await symlink(value.manifest.monitoring.alertDelivery.path, link);
    value.manifest.monitoring.alertDelivery.path = link;
    await expect(buildOperatorEvidence(value.manifest, now)).rejects.toThrow("bukan symlink");
  });

  it("menulis atomik tanpa overwrite, mode 0600, dan hash output cocok", async () => {
    const value = await fixture();
    const reports = await buildOperatorEvidence(value.manifest, now);
    const monitoringOutput = path.join(value.root, "monitoringReadiness.json");
    const writeFreezeOutput = path.join(value.root, "writeFreeze.json");
    const written = await writeOperatorEvidence(reports, { monitoringOutput, writeFreezeOutput });
    for (const [kind, file] of [["monitoringReadiness", monitoringOutput], ["writeFreeze", writeFreezeOutput]] as const) {
      const content = await readFile(file);
      expect(written[kind]).toMatchObject({ path: file, sizeBytes: content.length,
        sha256: createHash("sha256").update(content).digest("hex") });
      if (process.platform !== "win32") expect((await lstat(file)).mode & 0o777).toBe(0o600);
    }
    const monitoringBefore = await readFile(monitoringOutput);
    const writeFreezeBefore = await readFile(writeFreezeOutput);
    await expect(writeOperatorEvidence(reports, { monitoringOutput, writeFreezeOutput })).rejects.toThrow();
    expect(await readFile(monitoringOutput)).toEqual(monitoringBefore);
    expect(await readFile(writeFreezeOutput)).toEqual(writeFreezeBefore);
  });
});
