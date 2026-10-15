import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED_GATES = [
  "maintenancePageReviewed",
  "baselineReplay",
  "stagingReadiness",
  "smokeTest",
  "productionPreflight",
  "dataDeltaReconciled",
  "developWriteFreezeVerified",
  "productionWriteFreezeVerified",
  "databaseBackupVerified",
  "authBackupVerified",
  "configBackupVerified",
  "storageBackupVerified",
  "restoreDrillPassed",
  "rollbackDrillPassed",
  "pilotSchoolApproved",
];

const REQUIRED_REPORTS = [
  "baselineReplay",
  "stagingReadiness",
  "smokeTest",
  "rollbackDrill",
  "productionWriteFreeze",
  "finalBackupRestore",
  "productionPreflight",
  "dataDeltaReconciled",
  "pilotSchool",
];

const FREEZE_BOUND_REPORTS = new Set([
  "productionWriteFreeze",
  "finalBackupRestore",
  "productionPreflight",
  "dataDeltaReconciled",
  "pilotSchool",
]);

const usage = `Validasi bukti cutover final tanpa menghubungi atau memutasi production.
  node scripts/final-cutover-gate.mjs --checklist /absolute/checklist.json --backup-root /data/academy-cutover/RUN_ID

Checklist harus berisi target=production, freezeAt/expiresAt, pilotSchoolId,
rollbackCommand, gates, artifacts, dan reports. Setiap file wajib punya path absolut, sha256,
serta berada di bawah backup-root. Gate gagal tertutup: bukti hilang, hash salah, symlink,
backup-root bukan /data, freeze kedaluwarsa, atau perintah rollback destruktif ditolak.
Hasil validasi file BUKAN izin GO atau bukti probe live; keputusan operator wajib terpisah.`;

function parseArgs(args) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || !value || Object.hasOwn(values, key)) throw new Error("Argumen tidak valid");
    values[key] = value;
  }
  if (Object.keys(values).some((key) => !["--checklist", "--backup-root"].includes(key))) throw new Error("Argumen tidak dikenal");
  if (!path.isAbsolute(values["--checklist"] ?? "") || !path.isAbsolute(values["--backup-root"] ?? "")) {
    throw new Error("Checklist dan backup-root wajib path absolut");
  }
  return { checklist: values["--checklist"], backupRoot: values["--backup-root"] };
}

function isDataRoot(resolved, dataRoot) {
  return resolved === dataRoot || resolved.startsWith(`${dataRoot}/`);
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function verifiedFile(entry, resolvedRoot, label) {
  if (!path.isAbsolute(entry?.path ?? "") || !/^[a-f0-9]{64}$/.test(entry?.sha256 ?? "") ||
      !Number.isSafeInteger(entry?.sizeBytes) || entry.sizeBytes <= 0) {
    throw new Error(`Metadata ${label} tidak valid`);
  }
  const resolved = await realpath(entry.path);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error(`${label} keluar dari backup root`);
  const info = await lstat(entry.path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label} wajib file biasa, bukan symlink`);
  if (info.size !== entry.sizeBytes) throw new Error(`Ukuran tidak cocok: ${label}`);
  if (await sha256(entry.path) !== entry.sha256) throw new Error(`SHA-256 tidak cocok: ${label}`);
  return resolved;
}

async function validateReport(entry, resolvedRoot, now, freezeAt, expiresAt, pilotSchoolId, artifacts) {
  await verifiedFile(entry, resolvedRoot, `report ${entry?.kind ?? "unknown"}`);
  const report = JSON.parse(await readFile(entry.path, "utf8"));
  const startedAt = Date.parse(report.startedAt);
  const finishedAt = Date.parse(report.finishedAt);
  if (report.gate !== entry.kind || report.status !== "PASS" || report.exitCode !== 0 ||
      typeof report.command !== "string" || report.command.length < 8 ||
      !Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || startedAt > finishedAt || finishedAt > now.getTime() ||
      typeof report.operator !== "string" || report.operator.length < 2 ||
      typeof report.reviewer !== "string" || report.reviewer.length < 2 || report.operator === report.reviewer) {
    throw new Error(`Report ${entry.kind} tidak membuktikan PASS yang direview`);
  }
  const expectedTarget = FREEZE_BOUND_REPORTS.has(entry.kind) ? "production" : "staging";
  if (report.target !== expectedTarget) throw new Error(`Target report ${entry.kind} tidak valid`);
  if (FREEZE_BOUND_REPORTS.has(entry.kind) && (startedAt < freezeAt || finishedAt > expiresAt)) {
    throw new Error(`Report ${entry.kind} berada di luar window write freeze`);
  }
  if (entry.kind === "pilotSchool" && report.pilotSchoolId !== pilotSchoolId) {
    throw new Error("Report pilot tidak cocok dengan sekolah yang disetujui");
  }
  if (entry.kind === "productionPreflight") {
    if (report.readOnly !== true || report.syntheticBaseline !== false || report.baselineStatus !== "REVIEWED" ||
        report.baselineSource !== "historical-production-clone" ||
        !path.isAbsolute(report.baselineSourcePath ?? "") ||
        !/^[a-f0-9]{64}$/.test(report.baselineSourceSha256 ?? "") ||
        !/^[a-f0-9]{64}$/.test(report.baselineSha256 ?? "")) {
      throw new Error("Report productionPreflight tidak membuktikan baseline reviewed dan probe read-only");
    }
  }
  if (entry.kind === "finalBackupRestore") {
    const postgres = artifacts.get("postgres");
    if (report.restoreVerified !== true || report.backupSourcePath !== postgres?.path ||
        report.backupSourceSha256 !== postgres?.sha256) {
      throw new Error("Report finalBackupRestore tidak terikat backup PostgreSQL final");
    }
  }
}

function validateRollback(command) {
  if (typeof command !== "string" || command.length < 20) throw new Error("Rollback command belum diisi");
  const forbidden = [/\b(drop|truncate)\b/i, /\brm\s+-rf\b/i, /\breset\s+--hard\b/i,
    /\bproduction\b.*\brestore\b/i, /\bdown\b[^;&|]*\s-(?:v|\-volumes)\b/i,
    /\b(?:volume|system)\s+prune\b/i, /\bvolume\s+rm\b/i];
  if (forbidden.some((pattern) => pattern.test(command))) throw new Error("Rollback command berisiko destruktif");
  if (!/replacement|pengganti/i.test(command)) throw new Error("Rollback wajib memakai instance pengganti");
}

export async function verifyFinalCutover({ checklist, backupRoot }, now = new Date(), dataRoot = "/data") {
  const rootInfo = await lstat(backupRoot);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error("Backup root wajib direktori nyata");
  const resolvedRoot = await realpath(backupRoot);
  const normalizedRoot = resolvedRoot.replaceAll("\\", "/");
  const normalizedDataRoot = path.resolve(dataRoot).replaceAll("\\", "/");
  if (!isDataRoot(normalizedRoot, normalizedDataRoot)) throw new Error("Backup final wajib berada di /data");

  const checklistInfo = await lstat(checklist);
  if (!checklistInfo.isFile() || checklistInfo.isSymbolicLink()) throw new Error("Checklist wajib file biasa, bukan symlink");
  const resolvedChecklist = await realpath(checklist);
  if (!resolvedChecklist.startsWith(resolvedRoot + path.sep)) throw new Error("Checklist wajib berada di backup root");

  const document = JSON.parse(await readFile(checklist, "utf8"));
  if (document.target !== "production" || document.status !== "EVIDENCE_READY") throw new Error("Checklist belum siap diaudit");
  if (!document.pilotSchoolId || !/^[A-Za-z0-9_-]+$/.test(document.pilotSchoolId)) throw new Error("Pilot sekolah belum ditetapkan");
  const freezeAt = Date.parse(document.freezeAt);
  const expiresAt = Date.parse(document.expiresAt);
  if (!Number.isFinite(freezeAt) || !Number.isFinite(expiresAt) || freezeAt > now.getTime() || expiresAt <= now.getTime()) {
    throw new Error("Bukti write freeze belum aktif atau sudah kedaluwarsa");
  }
  for (const gate of REQUIRED_GATES) {
    if (document.gates?.[gate] !== true) throw new Error(`Gate belum lulus: ${gate}`);
  }
  validateRollback(document.rollbackCommand);
  if (!Array.isArray(document.artifacts) || document.artifacts.length < 4) throw new Error("Artifact backup belum lengkap");

  const requiredKinds = new Set(["postgres", "auth", "config", "storage"]);
  const artifacts = new Map();
  for (const artifact of document.artifacts) {
    if (!requiredKinds.delete(artifact.kind)) throw new Error("Jenis artifact duplikat atau tidak dikenal");
    const capturedAt = Date.parse(artifact.capturedAt);
    if (!Number.isFinite(capturedAt) || capturedAt < freezeAt || capturedAt > expiresAt) {
      throw new Error(`Artifact ${artifact.kind} bukan backup final dalam window write freeze`);
    }
    await verifiedFile(artifact, resolvedRoot, `artifact ${artifact.kind}`);
    artifacts.set(artifact.kind, artifact);
  }
  if (requiredKinds.size) throw new Error(`Artifact wajib belum ada: ${[...requiredKinds].join(", ")}`);
  if (!Array.isArray(document.reports)) throw new Error("Report gate wajib belum ada");
  const requiredReports = new Set(REQUIRED_REPORTS);
  for (const report of document.reports) {
    if (!requiredReports.delete(report.kind)) throw new Error("Jenis report duplikat atau tidak dikenal");
    await validateReport(report, resolvedRoot, now, freezeAt, expiresAt, document.pilotSchoolId, artifacts);
  }
  if (requiredReports.size) throw new Error(`Report gate wajib belum ada: ${[...requiredReports].join(", ")}`);
  return { status: "EVIDENCE_FILES_VALID_NOT_GO", pilotSchoolId: document.pilotSchoolId,
    artifactCount: document.artifacts.length, reportCount: document.reports.length, expiresAt: document.expiresAt };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) console.log(usage);
    else console.log(JSON.stringify(await verifyFinalCutover(options)));
  } catch (error) {
    console.error(`NO-GO: ${error.message}`);
    process.exitCode = 1;
  }
}
