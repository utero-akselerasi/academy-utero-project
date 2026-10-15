import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { collectHealth, newestBackupAgeHours, writeHealthReport } from "../scripts/ops-health.mjs";

async function writeBackup(root, name, overrides = {}) {
  const directory = path.join(root, name);
  await mkdir(directory);
  const artifacts = {
    "database.dump": "database\n",
    "storage.tar.gz": "archive\n",
    "storage.files.sha256": `${createHash("sha256").update("file\n").digest("hex")}  ./file.txt\n`,
    "metadata.env": `BACKUP_FORMAT=1\nBACKUP_NAME=${name}\nCREATED_AT_UTC=${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}\nDATABASE_DUMP_FORMAT=custom\nSTORAGE_ARCHIVE_FORMAT=tar.gz\n`,
    ...overrides,
  };
  for (const [file, content] of Object.entries(artifacts)) await writeFile(path.join(directory, file), content);
  const checksums = Object.entries(artifacts).map(([file, content]) =>
    `${createHash("sha256").update(content).digest("hex")}  ${file}`).join("\n");
  await writeFile(path.join(directory, "SHA256SUMS"), `${checksums}\n`);
  return directory;
}

test("newestBackupAgeHours menolak backup palsu dan artefak corrupt", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "academy-ops-"));
  await mkdir(path.join(root, "fake"));
  await writeFile(path.join(root, "fake", "metadata.env"), "BACKUP_FORMAT=1\nBACKUP_NAME=fake\n");
  const corrupt = await writeBackup(root, "corrupt");
  await writeFile(path.join(corrupt, "storage.files.sha256"), "corrupted after checksums\n");
  assert.equal(await newestBackupAgeHours(root), null);
});

test("newestBackupAgeHours menerima backup lengkap dengan checksum valid", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "academy-ops-valid-"));
  await writeBackup(root, "academy-valid");
  const age = await newestBackupAgeHours(root, Date.now() + 1000);
  assert.equal(typeof age, "number");
  assert.ok(age >= 0 && age < 1);
});

test("newestBackupAgeHours tidak memakai mtime metadata backup lama", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "academy-ops-old-"));
  await writeBackup(root, "academy-old", {
    "metadata.env": "BACKUP_FORMAT=1\nBACKUP_NAME=academy-old\nCREATED_AT_UTC=20200101T000000Z\nDATABASE_DUMP_FORMAT=custom\nSTORAGE_ARCHIVE_FORMAT=tar.gz\n",
  });
  assert.ok((await newestBackupAgeHours(root)) > 24 * 365);
});

test("collectHealth gagal tertutup saat API dan database tidak tersedia", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "academy-health-"));
  const report = await collectHealth({
    apiUrl: "http://127.0.0.1:1/health/ready",
    databaseUrl: "postgresql://invalid:invalid@127.0.0.1:1/invalid",
    storageRoot: root,
    backupRoot: root,
    offsiteRoot: root,
    timeoutMs: 100,
    minimumFreePercent: 0,
    maximumBackupAgeHours: 24,
  });
  assert.equal(report.ok, false);
  assert.equal(report.gate, "opsHealth");
  assert.equal(report.target, "local");
  assert.equal(report.status, "FAIL");
  assert.equal(report.checks.api.ok, false);
  assert.equal(report.checks.database.ok, false);
  assert.equal(report.checks.backupFreshness.ok, false);
  assert.equal(report.checks.offsiteBackupFreshness.ok, false);
  assert.equal(report.checks.offsiteIsolation.ok, false);
});

test("collectHealth mempertahankan target production pada evidence", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "academy-health-target-"));
  const report = await collectHealth({
    target: "production",
    apiUrl: "http://127.0.0.1:1/health/ready",
    databaseUrl: "postgresql://invalid:invalid@127.0.0.1:1/invalid",
    storageRoot: root,
    backupRoot: root,
    offsiteRoot: root,
    timeoutMs: 100,
    minimumFreePercent: 0,
    maximumBackupAgeHours: 24,
  });
  assert.equal(report.gate, "opsHealth");
  assert.equal(report.target, "production");
});

test("writeHealthReport mengganti output secara atomik tanpa menyisakan file sementara", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "academy-health-report-"));
  const output = path.join(root, "monitoring.json");
  await writeFile(output, "stale\n");
  await writeHealthReport({ gate: "opsHealth", target: "production", status: "PASS" }, output);
  assert.deepEqual(JSON.parse(await readFile(output, "utf8")), {
    gate: "opsHealth", target: "production", status: "PASS",
  });
  assert.deepEqual(await readdir(root), ["monitoring.json"]);
});

test("writeHealthReport menolak output relatif", async () => {
  await assert.rejects(
    writeHealthReport({ gate: "opsHealth" }, "ops-health.json"),
    /OPS_HEALTH_OUTPUT wajib path absolut/,
  );
});

test("skrip operasi memiliki guard keselamatan wajib", async () => {
  const scripts = new Map();
  for (const name of ["backup-selfhosted.sh", "restore-selfhosted.sh", "replicate-backup-offsite.sh", "prune-selfhosted-backups.sh"]) {
    scripts.set(name, await import("node:fs/promises").then(({ readFile }) => readFile(new URL(`../scripts/${name}`, import.meta.url), "utf8")));
  }
  assert.match(scripts.get("backup-selfhosted.sh"), /verify-selfhosted-backup\.sh/);
  assert.match(scripts.get("restore-selfhosted.sh"), /CONFIRM_RESTORE/);
  assert.match(scripts.get("replicate-backup-offsite.sh"), /filesystem yang sama/);
  assert.match(scripts.get("prune-selfhosted-backups.sh"), /prune-expired-backups/);
});
