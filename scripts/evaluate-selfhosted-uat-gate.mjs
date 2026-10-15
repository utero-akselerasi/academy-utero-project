#!/usr/bin/env node
import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const REQUIRED_UAT_EVIDENCE = Object.freeze([
  "migrationVerification", "storageVerification", "rbacVerification", "roleSmoke", "readonlyUatPerformance",
  "backupRestore", "rollbackRehearsal", "tlsPreflight", "smtpSmoke", "opsHealth", "monitoringReadiness", "writeFreeze",
]);

const usage = `Evaluasi bukti UAT/cutover self-hosted secara fail-closed, tanpa probe live atau cutover.
  node scripts/evaluate-selfhosted-uat-gate.mjs --checklist /secure/evidence/uat-checklist.json

Checklist dan semua evidence wajib file biasa, path absolut, SHA-256 dan ukuran cocok,
target production, status PASS, belum kedaluwarsa, serta operator berbeda dari reviewer.`;

const REQUIRED_ROLES = Object.freeze(["super_admin", "admin", "school", "intern", "applicant"]);
const REQUIRED_WRITERS = Object.freeze(["web", "api", "scheduled-jobs", "edge-functions", "webhooks", "legacy-clients", "direct-uploads"]);

function requireEvidence(condition, kind, detail) {
  if (!condition) throw new Error(`Evidence ${kind} tidak lengkap: ${detail}`);
}

function validSourceArtifact(artifact) {
  return artifact && typeof artifact === "object" && path.isAbsolute(artifact.path ?? "") &&
    /^[a-f0-9]{64}$/.test(artifact.sha256 ?? "") && Number.isSafeInteger(artifact.sizeBytes) && artifact.sizeBytes > 0 &&
    typeof artifact.observedAt === "string" &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(artifact.observedAt) &&
    new Date(artifact.observedAt).toISOString() ===
      artifact.observedAt.replace(/Z$/, artifact.observedAt.includes(".") ? "Z" : ".000Z");
}

async function verifyOperatorSourceArtifact(artifact, reviewedAt, now, kind) {
  if (!validSourceArtifact(artifact)) throw new Error(`Evidence ${kind} source artifact tidak valid`);
  const observedAt = Date.parse(artifact.observedAt);
  if (observedAt > reviewedAt || observedAt > now.getTime() || reviewedAt - observedAt > 24 * 60 * 60 * 1000) {
    throw new Error(`Evidence ${kind} source artifact timestamp tidak valid`);
  }
  const info = await lstat(artifact.path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Evidence ${kind} source artifact wajib file biasa`);
  const content = await readFile(artifact.path);
  if (content.length !== artifact.sizeBytes || createHash("sha256").update(content).digest("hex") !== artifact.sha256) {
    throw new Error(`Evidence ${kind} source artifact berubah`);
  }
}

export function validateEvidenceReport(kind, report) {
  const checks = report?.checks;
  switch (kind) {
    case "migrationVerification":
      requireEvidence(Array.isArray(report.failures) && report.failures.length === 0, kind, "failures wajib kosong");
      requireEvidence(Number.isSafeInteger(report.tableCount) && report.tableCount > 0, kind, "tableCount wajib positif");
      requireEvidence(Number.isSafeInteger(report.foreignKeysChecked) && report.foreignKeysChecked > 0, kind, "FK belum diverifikasi");
      break;
    case "storageVerification":
      requireEvidence(Array.isArray(report.failures) && report.failures.length === 0, kind, "failures wajib kosong");
      requireEvidence(Number.isSafeInteger(report.storageObjects) && report.storageObjects >= 0, kind, "storageObjects tidak valid");
      requireEvidence(report.storageBytesChecked === report.storageObjects, kind, "byte objek belum seluruhnya diverifikasi");
      break;
    case "rbacVerification":
      requireEvidence(REQUIRED_ROLES.every((role) => report.roles?.includes(role)), kind, "lima role wajib diverifikasi");
      requireEvidence(report.permissionMismatchCount === 0 && report.orphanAssignmentCount === 0, kind, "mismatch/orphan RBAC ditemukan");
      break;
    case "roleSmoke": {
      requireEvidence(Array.isArray(report.results), kind, "results wajib tersedia");
      const roles = report.results.map((entry) => entry.role);
      requireEvidence(REQUIRED_ROLES.every((role) => roles.includes(role)), kind, "hasil lima role tidak lengkap");
      requireEvidence(report.anonymousStatus === 401 && report.negativeChecks >= 4 && report.secureCookies === 5,
        kind, "probe anonim/negatif atau cookie Secure tidak lengkap");
      requireEvidence(report.results.every((entry) => entry.status >= 200 && entry.status < 300), kind, "probe positif gagal");
      requireEvidence(report.results.filter((entry) => entry.forbiddenEndpoint).length >= 4 &&
        report.results.every((entry) => !entry.forbiddenEndpoint || entry.forbiddenStatus === 403),
      kind, "hasil probe negatif tidak lengkap");
      break;
    }
    case "readonlyUatPerformance":
      requireEvidence(report.result?.completed === report.limits?.requests && report.result.completed > 0, kind, "request tidak selesai");
      requireEvidence(report.result.errorRate <= report.limits.maxErrorRate && report.result.p95Ms <= report.limits.p95BudgetMs,
        kind, "budget error/latency terlampaui");
      break;
    case "backupRestore":
      requireEvidence(checks?.database?.ok === true && checks?.storage?.ok === true && checks?.safetyBackup?.ok === true,
        kind, "database, storage, atau safety backup belum terbukti");
      break;
    case "rollbackRehearsal":
      requireEvidence(checks?.databaseMarker?.ok === true && checks?.storageMarker?.ok === true && checks?.readiness?.status === 200,
        kind, "marker DB/storage atau readiness rollback gagal");
      requireEvidence(Number.isFinite(report.rtoSeconds) && report.rtoSeconds > 0, kind, "RTO belum dicatat");
      break;
    case "tlsPreflight":
      requireEvidence(checks && Object.values(checks).length >= 4 && Object.values(checks).every((entry) => entry?.ok === true),
        kind, "seluruh pemeriksaan TLS wajib lulus");
      break;
    case "smtpSmoke":
      requireEvidence(checks?.configuration?.ok === true && checks?.tlsAndAuthentication?.ok === true && checks?.delivery?.ok === true,
        kind, "konfigurasi, TLS/auth, atau delivery SMTP gagal");
      break;
    case "opsHealth":
      requireEvidence(checks && ["api", "database", "storageDisk", "backupDisk", "offsiteDisk", "backupFreshness",
        "offsiteBackupFreshness", "offsiteIsolation"].every((name) => checks[name]?.ok === true), kind, "health operasional tidak lengkap");
      break;
    case "monitoringReadiness":
      requireEvidence(checks?.alertDelivery?.ok === true && checks?.errorRate?.ok === true && checks?.latency?.ok === true &&
        checks?.capacity?.ok === true, kind, "alert atau metrik monitoring belum terbukti");
      requireEvidence(["alertDelivery", "errorRate", "latency", "capacity"].every((name) =>
        validSourceArtifact(checks[name]?.sourceArtifact)), kind, "source artifact monitoring tidak lengkap");
      break;
    case "writeFreeze": {
      requireEvidence(Array.isArray(report.writers) && report.writers.length === REQUIRED_WRITERS.length && REQUIRED_WRITERS.every((name) =>
        report.writers.filter((entry) => entry?.name === name && entry.frozen === true &&
          ["frozen", "inactive"].includes(entry.state) && validSourceArtifact(entry.sourceArtifact)).length === 1),
        kind, "seluruh writer belum dibekukan");
      requireEvidence(checks?.sourceWriteProbe?.ok === true && checks.sourceWriteProbe.blocked === true &&
        validSourceArtifact(checks.sourceWriteProbe.sourceArtifact) && checks?.queueDrained?.ok === true &&
        checks.queueDrained.pending === 0 && validSourceArtifact(checks.queueDrained.sourceArtifact),
      kind, "freeze/queue belum diverifikasi");
      break;
    }
    default:
      throw new Error(`Jenis evidence tidak dikenal: ${kind}`);
  }
  return true;
}

function parseArgs(args) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  if (args.length !== 2 || args[0] !== "--checklist" || !path.isAbsolute(args[1])) throw new Error(usage);
  return { checklist: args[1] };
}

async function verifiedEvidence(entry, root) {
  if (!REQUIRED_UAT_EVIDENCE.includes(entry?.kind)) throw new Error(`Jenis evidence tidak dikenal: ${entry?.kind}`);
  if (!path.isAbsolute(entry?.path ?? "") || !/^[a-f0-9]{64}$/.test(entry?.sha256 ?? "") ||
      !Number.isSafeInteger(entry?.sizeBytes) || entry.sizeBytes < 1) throw new Error(`Metadata evidence ${entry?.kind} tidak valid`);
  const info = await lstat(entry.path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Evidence ${entry.kind} wajib file biasa`);
  const resolved = await realpath(entry.path);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error(`Evidence ${entry.kind} di luar direktori checklist`);
  const content = await readFile(resolved);
  if (content.length !== entry.sizeBytes) throw new Error(`Ukuran evidence ${entry.kind} tidak cocok`);
  if (createHash("sha256").update(content).digest("hex") !== entry.sha256) throw new Error(`SHA-256 evidence ${entry.kind} tidak cocok`);
  const report = JSON.parse(content.toString("utf8"));
  return { entry, report };
}

export async function evaluateSelfhostedUatGate(checklistPath, now = new Date()) {
  const checklistInfo = await lstat(checklistPath);
  if (!checklistInfo.isFile() || checklistInfo.isSymbolicLink()) throw new Error("Checklist wajib file biasa");
  const resolvedChecklist = await realpath(checklistPath);
  const root = path.dirname(resolvedChecklist);
  const checklist = JSON.parse(await readFile(resolvedChecklist, "utf8"));
  if (checklist.schemaVersion !== 1 || checklist.target !== "production") throw new Error("Checklist production schemaVersion 1 wajib digunakan");
  if (typeof checklist.operator !== "string" || !checklist.operator.trim() ||
      typeof checklist.reviewer !== "string" || !checklist.reviewer.trim() ||
      checklist.operator.trim().toLowerCase() === checklist.reviewer.trim().toLowerCase()) {
    throw new Error("Operator dan reviewer wajib berbeda");
  }
  if (!Array.isArray(checklist.evidence)) throw new Error("Daftar evidence wajib tersedia");
  const kinds = checklist.evidence.map((entry) => entry.kind);
  for (const kind of REQUIRED_UAT_EVIDENCE) {
    if (kinds.filter((value) => value === kind).length !== 1) throw new Error(`Evidence ${kind} wajib tepat satu`);
  }
  if (kinds.length !== REQUIRED_UAT_EVIDENCE.length) throw new Error("Checklist memuat evidence tambahan atau duplikat");
  const verified = await Promise.all(checklist.evidence.map((entry) => verifiedEvidence(entry, root)));
  for (const { entry, report } of verified) {
    if (report.gate !== entry.kind || report.target !== "production" || report.status !== "PASS") {
      throw new Error(`Evidence ${entry.kind} bukan PASS production yang sesuai`);
    }
    validateEvidenceReport(entry.kind, report);
    const observedAt = Date.parse(report.finishedAt ?? report.observedAt);
    const expiresAt = Date.parse(report.expiresAt);
    const maximumLifetimeMs = entry.kind === "opsHealth" ? 10 * 60 * 1000 : 24 * 60 * 60 * 1000;
    if (!Number.isFinite(observedAt) || !Number.isFinite(expiresAt) || observedAt > now.getTime() ||
        expiresAt < now.getTime() || expiresAt < observedAt || expiresAt - observedAt > maximumLifetimeMs) {
      throw new Error(`Evidence ${entry.kind} kedaluwarsa atau timestamp tidak valid`);
    }
    if (entry.kind === "monitoringReadiness" || entry.kind === "writeFreeze") {
      if (report.operator !== checklist.operator || report.reviewer !== checklist.reviewer) {
        throw new Error(`Evidence ${entry.kind} operator atau reviewer tidak sesuai checklist`);
      }
      const artifacts = entry.kind === "monitoringReadiness"
        ? ["alertDelivery", "errorRate", "latency", "capacity"].map((name) => report.checks[name].sourceArtifact)
        : [...report.writers.map((writer) => writer.sourceArtifact), report.checks.sourceWriteProbe.sourceArtifact,
          report.checks.queueDrained.sourceArtifact];
      for (const artifact of artifacts) await verifyOperatorSourceArtifact(artifact, observedAt, now, entry.kind);
    }
  }
  return { decision: "GO", target: "production", evidenceCount: verified.length, evaluatedAt: now.toISOString(),
    note: "Keputusan ini hanya valid untuk evidence terverifikasi; eksekusi DNS/cutover tetap tindakan operator terpisah." };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) console.log(usage);
    else console.log(JSON.stringify(await evaluateSelfhostedUatGate(options.checklist), null, 2));
  } catch (error) {
    console.error(`NO-GO: ${error.message}`);
    process.exitCode = 1;
  }
}
