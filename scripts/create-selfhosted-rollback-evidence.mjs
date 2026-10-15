#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { link, lstat, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MAX_INPUT_BYTES = 1024 * 1024;
const PRODUCTION_CONFIRMATION = "production-candidate-rollback-rehearsal";
const SHA256 = /^[a-f0-9]{64}$/;
const BACKUP_NAME = /^[A-Za-z0-9._-]+$/;
const usage = `Buat evidence rollback rehearsal dari restore dua arah dan probe read-only.
  node scripts/create-selfhosted-rollback-evidence.mjs \\
    --baseline-restore <restore.env> --rollback-restore <restore.env> \\
    --probes <probes.json> --output <evidence.json> \\
    [--target local|production] [--confirm production-candidate-rollback-rehearsal]`;

function fail(message) {
  throw new Error(message);
}

function parseOptions(args) {
  if (args.length % 2 !== 0) fail(usage);
  const allowed = new Set(["--baseline-restore", "--rollback-restore", "--probes", "--output", "--target", "--confirm"]);
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!allowed.has(key) || Object.hasOwn(values, key) || !args[index + 1]) fail(usage);
    values[key] = args[index + 1];
  }
  return values;
}

export function parseRollbackEvidenceArgs(args) {
  const values = parseOptions(args);
  const target = values["--target"] ?? "local";
  if (!new Set(["local", "production"]).has(target)) fail("--target wajib local atau production");
  for (const key of ["--baseline-restore", "--rollback-restore", "--probes", "--output"]) {
    if (!path.isAbsolute(values[key] ?? "")) fail(`${key} wajib path absolut`);
  }
  const inputs = [values["--baseline-restore"], values["--rollback-restore"], values["--probes"]].map((item) => path.resolve(item));
  if (new Set(inputs).size !== inputs.length || inputs.includes(path.resolve(values["--output"]))) fail("Path input dan output wajib berbeda");
  if (target === "production" && values["--confirm"] !== PRODUCTION_CONFIRMATION) {
    fail(`Target production memerlukan --confirm ${PRODUCTION_CONFIRMATION}`);
  }
  if (target === "local" && values["--confirm"] !== undefined) fail("--confirm hanya boleh untuk target production");
  return {
    target,
    baselineRestore: values["--baseline-restore"],
    rollbackRestore: values["--rollback-restore"],
    probes: values["--probes"],
    output: values["--output"],
  };
}

function parseTimestamp(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) fail(`${label} wajib timestamp UTC ISO 8601`);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value.replace(/Z$/, value.includes(".") ? "Z" : ".000Z")) {
    fail(`${label} tidak valid`);
  }
  return date;
}

function restoreTimestamp(value, label) {
  if (typeof value !== "string" || !/^\d{8}T\d{6}Z$/.test(value)) fail(`${label} tidak valid`);
  return parseTimestamp(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`, label);
}

export function parseRestoreEvidence(content, label = "restore evidence") {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    if (!line) continue;
    const separator = line.indexOf("=");
    if (separator < 1) fail(`${label} memuat baris tidak valid`);
    const key = line.slice(0, separator);
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || Object.hasOwn(values, key)) fail(`${label} memuat key tidak valid atau ganda`);
    values[key] = line.slice(separator + 1);
  }
  const required = ["RESTORE_EVIDENCE_FORMAT", "BACKUP_NAME", "PRE_RESTORE_BACKUP_NAME", "RESTORED_AT_UTC", "BACKUP_SHA256SUMS", "DATABASE_PROBE"];
  if (required.some((key) => !Object.hasOwn(values, key))) fail(`${label} tidak lengkap`);
  if (values.RESTORE_EVIDENCE_FORMAT !== "1" || !BACKUP_NAME.test(values.BACKUP_NAME) || !BACKUP_NAME.test(values.PRE_RESTORE_BACKUP_NAME) ||
      values.BACKUP_NAME === values.PRE_RESTORE_BACKUP_NAME || !SHA256.test(values.BACKUP_SHA256SUMS) || values.DATABASE_PROBE !== "1") {
    fail(`${label} gagal validasi fail-closed`);
  }
  const restoredAt = restoreTimestamp(values.RESTORED_AT_UTC, `${label} RESTORED_AT_UTC`);
  return {
    format: 1,
    evidenceSha256: createHash("sha256").update(content).digest("hex"),
    backupName: values.BACKUP_NAME,
    preRestoreBackupName: values.PRE_RESTORE_BACKUP_NAME,
    restoredAt: restoredAt.toISOString(),
    backupSha256Sums: values.BACKUP_SHA256SUMS,
    databaseProbe: 1,
  };
}

function validatePhase(phase, expectedMarker, label) {
  if (!phase || typeof phase !== "object") fail(`Probe ${label} tidak lengkap`);
  const database = phase.database;
  const storage = phase.storage;
  const readiness = phase.readiness;
  if (database?.readOnly !== true || database?.ok !== true || database?.marker !== expectedMarker) fail(`Probe database ${label} gagal atau tidak read-only`);
  if (storage?.readOnly !== true || storage?.ok !== true || storage?.marker !== expectedMarker || !SHA256.test(storage?.sha256 ?? "")) {
    fail(`Probe storage ${label} gagal atau tidak read-only`);
  }
  if (readiness?.readOnly !== true || readiness?.method !== "GET" || readiness?.ok !== true || readiness?.statusCode !== 200) {
    fail(`Probe readiness ${label} gagal atau tidak read-only`);
  }
  return {
    database: { readOnly: true, ok: true, marker: database.marker },
    storage: { readOnly: true, ok: true, marker: storage.marker, sha256: storage.sha256 },
    readiness: { readOnly: true, method: "GET", ok: true, statusCode: 200 },
  };
}

export function createRollbackRehearsalEvidence({ target, baselineRestore, rollbackRestore, probes }) {
  if (!new Set(["local", "production"]).has(target)) fail("Target evidence tidak valid");
  if (probes?.schemaVersion !== 1 || probes?.kind !== "selfhosted-rollback-readonly-probes") fail("Format probe tidak didukung");
  if (!new Set(["fixture", "production-candidate"]).has(probes.dataClass)) fail("dataClass probe tidak valid");
  if (target === "production" && probes.dataClass !== "production-candidate") fail("Fixture tidak boleh dinyatakan sebagai rollback production");
  if (baselineRestore.backupName === rollbackRestore.backupName) fail("Restore dua arah wajib memakai backup berbeda");
  const startedAt = parseTimestamp(probes.startedAt, "startedAt");
  const finishedAt = parseTimestamp(probes.finishedAt, "finishedAt");
  const baselineAt = parseTimestamp(baselineRestore.restoredAt, "baseline restoredAt");
  const rollbackAt = parseTimestamp(rollbackRestore.restoredAt, "rollback restoredAt");
  if (!(startedAt <= baselineAt && baselineAt <= rollbackAt && rollbackAt <= finishedAt) || finishedAt <= startedAt) {
    fail("Urutan timestamp rehearsal/restore tidak terverifikasi");
  }
  if (typeof probes.baselineMarker !== "string" || typeof probes.rollbackMarker !== "string" ||
      !probes.baselineMarker || !probes.rollbackMarker || probes.baselineMarker === probes.rollbackMarker) {
    fail("Marker baseline dan rollback wajib berbeda");
  }
  const phases = {
    baseline: validatePhase(probes.phases?.baseline, probes.baselineMarker, "baseline"),
    rollback: validatePhase(probes.phases?.rollback, probes.rollbackMarker, "rollback"),
  };
  const productionClaim = target === "production" && probes.dataClass === "production-candidate";
  return {
    schemaVersion: 1,
    gate: "rollbackRehearsal",
    target,
    dataClass: probes.dataClass,
    claim: productionClaim ? "production-candidate-rollback-rehearsed" : "isolated-fixture-rollback-rehearsed",
    productionRollbackClaimed: productionClaim,
    status: "PASS",
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    expiresAt: new Date(finishedAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    rtoSeconds: Math.ceil((finishedAt.getTime() - startedAt.getTime()) / 1000),
    checks: {
      databaseMarker: { ok: phases.baseline.database.ok && phases.rollback.database.ok },
      storageMarker: { ok: phases.baseline.storage.ok && phases.rollback.storage.ok },
      readiness: { status: phases.rollback.readiness.statusCode },
    },
    restoreSequence: [baselineRestore, rollbackRestore],
    markers: { baseline: probes.baselineMarker, rollback: probes.rollbackMarker },
    probes: phases,
  };
}

async function readRegularFile(file, label) {
  const metadata = await lstat(file);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_INPUT_BYTES) fail(`${label} wajib file reguler non-symlink maksimal 1 MiB`);
  return { content: await readFile(file, "utf8"), path: path.resolve(file) };
}

export async function loadRollbackEvidenceInputs(config) {
  const [baselineFile, rollbackFile, probesFile] = await Promise.all([
    readRegularFile(config.baselineRestore, "--baseline-restore"),
    readRegularFile(config.rollbackRestore, "--rollback-restore"),
    readRegularFile(config.probes, "--probes"),
  ]);
  let probes;
  try { probes = JSON.parse(probesFile.content); } catch { fail("--probes bukan JSON valid"); }
  return {
    baselineRestore: { sourcePath: baselineFile.path, ...parseRestoreEvidence(baselineFile.content, "baseline restore evidence") },
    rollbackRestore: { sourcePath: rollbackFile.path, ...parseRestoreEvidence(rollbackFile.content, "rollback restore evidence") },
    probes,
  };
}

export async function writeRollbackRehearsalEvidence(report, output) {
  const content = `${JSON.stringify(report, null, 2)}\n`;
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, { mode: 0o600, flag: "wx" });
  try {
    await link(temporary, output);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
  return { path: output, sizeBytes: Buffer.byteLength(content), sha256: createHash("sha256").update(content).digest("hex") };
}

async function main() {
  let output = null;
  try {
    const config = parseRollbackEvidenceArgs(process.argv.slice(2));
    output = config.output;
    const inputs = await loadRollbackEvidenceInputs(config);
    const report = createRollbackRehearsalEvidence({ target: config.target, ...inputs });
    const artifact = await writeRollbackRehearsalEvidence(report, config.output);
    process.stdout.write(`${JSON.stringify({ status: report.status, artifact })}\n`);
  } catch {
    process.stderr.write(`${JSON.stringify({ status: "FAIL", error: "Rollback rehearsal evidence gagal dibuat", output })}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
