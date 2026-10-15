#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { chmod, link, lstat, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const REQUIRED_WRITERS = Object.freeze([
  "web", "api", "scheduled-jobs", "edge-functions", "webhooks", "legacy-clients", "direct-uploads",
]);
const MONITORING_CHECKS = Object.freeze(["alertDelivery", "errorRate", "latency", "capacity"]);
const usage = `Buat evidence manual monitoringReadiness dan writeFreeze secara fail-closed.
  node scripts/create-selfhosted-operator-evidence.mjs \\
    --input <manifest-absolut.json> \\
    --monitoring-output <monitoringReadiness-absolut.json> \\
    --write-freeze-output <writeFreeze-absolut.json>

Manifest dan seluruh source artifact wajib file reguler non-symlink dengan path absolut, SHA-256, dan observedAt.`;

function fail(message) {
  throw new Error(message);
}

function parseIsoTimestamp(value, label, now) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) fail(`${label} wajib timestamp ISO UTC`);
  const timestamp = Date.parse(value);
  const canonical = value.includes(".") ? value : value.replace("Z", ".000Z");
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== canonical) fail(`${label} bukan tanggal kalender UTC valid`);
  if (timestamp > now.getTime() || now.getTime() - timestamp > MAX_AGE_MS) {
    fail(`${label} berada di masa depan atau lebih tua dari 24 jam`);
  }
  return value;
}

function requiredIdentity(value, label) {
  if (typeof value !== "string" || value.trim() !== value || value.length < 3 || value.length > 200 || /[\r\n\u0000]/.test(value)) {
    fail(`${label} tidak valid`);
  }
  return value;
}

export function parseOperatorEvidenceArgs(args) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  if (args.length !== 6) fail(usage);
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!new Set(["--input", "--monitoring-output", "--write-freeze-output"]).has(key) || Object.hasOwn(values, key)) fail(usage);
    values[key] = args[index + 1];
  }
  for (const value of Object.values(values)) if (!path.isAbsolute(value ?? "")) fail(usage);
  const resolved = Object.values(values).map((value) => path.resolve(value));
  if (new Set(resolved).size !== resolved.length) fail("Input dan kedua output wajib berbeda");
  return { input: values["--input"], monitoringOutput: values["--monitoring-output"],
    writeFreezeOutput: values["--write-freeze-output"] };
}

async function verifySourceArtifact(descriptor, label, now) {
  if (!descriptor || typeof descriptor !== "object" || !path.isAbsolute(descriptor.path ?? "") ||
      !/^[a-f0-9]{64}$/.test(descriptor.sha256 ?? "")) fail(`${label} wajib memiliki path absolut dan SHA-256 lowercase`);
  parseIsoTimestamp(descriptor.observedAt, `${label}.observedAt`, now);
  const info = await lstat(descriptor.path);
  if (!info.isFile() || info.isSymbolicLink()) fail(`${label} wajib file reguler, bukan symlink`);
  const content = await readFile(descriptor.path);
  const sha256 = createHash("sha256").update(content).digest("hex");
  if (sha256 !== descriptor.sha256) fail(`SHA-256 ${label} tidak cocok`);
  return { path: path.resolve(descriptor.path), sha256, sizeBytes: content.length, observedAt: descriptor.observedAt };
}

export async function buildOperatorEvidence(manifest, now = new Date()) {
  if (manifest?.schemaVersion !== 1 || manifest?.target !== "production") fail("Manifest schemaVersion 1 target production wajib digunakan");
  const operator = requiredIdentity(manifest.operator, "operator");
  const reviewer = requiredIdentity(manifest.reviewer, "reviewer");
  if (operator === reviewer) fail("Operator dan reviewer wajib berbeda");
  const reviewedAt = parseIsoTimestamp(manifest.reviewedAt, "reviewedAt", now);
  const monitoring = {};
  for (const name of MONITORING_CHECKS) monitoring[name] = await verifySourceArtifact(manifest.monitoring?.[name], `monitoring.${name}`, now);
  if (!Array.isArray(manifest.writers) || manifest.writers.length !== REQUIRED_WRITERS.length) fail("Tepat tujuh writer wajib tersedia");
  const writers = [];
  for (const name of REQUIRED_WRITERS) {
    const matches = manifest.writers.filter((entry) => entry?.name === name);
    if (matches.length !== 1 || !new Set(["frozen", "inactive"]).has(matches[0].state)) fail(`State writer ${name} wajib frozen atau inactive`);
    writers.push({ name, state: matches[0].state, frozen: true,
      sourceArtifact: await verifySourceArtifact(matches[0].artifact, `writer.${name}`, now) });
  }
  if (manifest.writers.some((entry) => !REQUIRED_WRITERS.includes(entry?.name))) fail("Writer tambahan tidak diizinkan");
  const sourceWriteProbe = await verifySourceArtifact(manifest.sourceWriteProbe?.artifact, "sourceWriteProbe", now);
  if (manifest.sourceWriteProbe?.blocked !== true) fail("Source write probe wajib membuktikan write diblokir");
  const queueDrained = await verifySourceArtifact(manifest.queueDrained?.artifact, "queueDrained", now);
  if (manifest.queueDrained?.pending !== 0) fail("Queue wajib memiliki pending 0");
  const latestObservedAt = Math.max(
    ...Object.values(monitoring).map((artifact) => Date.parse(artifact.observedAt)),
    ...writers.map((writer) => Date.parse(writer.sourceArtifact.observedAt)),
    Date.parse(sourceWriteProbe.observedAt),
    Date.parse(queueDrained.observedAt),
  );
  if (Date.parse(reviewedAt) < latestObservedAt) fail("reviewedAt wajib sama atau setelah seluruh observedAt");
  const expiresAt = new Date(Date.parse(reviewedAt) + MAX_AGE_MS).toISOString();
  const common = { schemaVersion: 1, target: "production", status: "PASS", finishedAt: reviewedAt, expiresAt, operator, reviewer };
  return {
    monitoringReadiness: { ...common, gate: "monitoringReadiness", mode: "manual-source-artifact-review",
      checks: Object.fromEntries(MONITORING_CHECKS.map((name) => [name, { ok: true, sourceArtifact: monitoring[name] }])) },
    writeFreeze: { ...common, gate: "writeFreeze", mode: "manual-source-artifact-review", writers,
      checks: { sourceWriteProbe: { ok: true, blocked: true, sourceArtifact: sourceWriteProbe },
        queueDrained: { ok: true, pending: 0, sourceArtifact: queueDrained } } },
  };
}

async function writeAtomicJson(output, value) {
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.${randomUUID()}.tmp`;
  const content = `${JSON.stringify(value, null, 2)}\n`;
  try {
    await writeFile(temporary, content, { flag: "wx", mode: 0o600 });
    await chmod(temporary, 0o600);
    await link(temporary, output);
    await chmod(output, 0o600);
    await unlink(temporary);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
  return { path: output, sizeBytes: Buffer.byteLength(content), sha256: createHash("sha256").update(content).digest("hex") };
}

export async function writeOperatorEvidence(reports, outputs) {
  const monitoring = await writeAtomicJson(outputs.monitoringOutput, reports.monitoringReadiness);
  try {
    const writeFreeze = await writeAtomicJson(outputs.writeFreezeOutput, reports.writeFreeze);
    return { monitoringReadiness: monitoring, writeFreeze };
  } catch (error) {
    await unlink(outputs.monitoringOutput).catch(() => {});
    throw error;
  }
}

async function main() {
  try {
    const options = parseOperatorEvidenceArgs(process.argv.slice(2));
    if (options.help) return process.stdout.write(`${usage}\n`);
    const inputInfo = await lstat(options.input);
    if (!inputInfo.isFile() || inputInfo.isSymbolicLink()) fail("Manifest wajib file reguler, bukan symlink");
    const manifest = JSON.parse(await readFile(options.input, "utf8"));
    const reports = await buildOperatorEvidence(manifest);
    const evidence = await writeOperatorEvidence(reports, options);
    process.stdout.write(`${JSON.stringify({ status: "PASS", target: "production", evidence })}\n`);
  } catch {
    process.stderr.write(`${JSON.stringify({ status: "FAIL", error: "Evidence operator tidak lengkap atau tidak valid; output tidak dapat dipercaya" })}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
