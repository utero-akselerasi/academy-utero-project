#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { chmod, lstat, readFile, readdir, realpath, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { evaluateSelfhostedUatGate, REQUIRED_UAT_EVIDENCE } from "./evaluate-selfhosted-uat-gate.mjs";

const usage = `Bangun checklist UAT self-hosted dari tepat 12 evidence JSON dalam satu direktori.
  node scripts/build-selfhosted-uat-checklist.mjs --evidence-dir /secure/evidence --operator operator-a --reviewer reviewer-b --output /secure/evidence/uat-checklist.json

evidence-dir dan output wajib path absolut, output wajib berada langsung dalam evidence-dir,
serta operator dan reviewer wajib berbeda.`;
const KNOWN_NON_EVIDENCE_JSON = new Set(["operator-review.json"]);

function parseArgs(args) {
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) return { help: true };
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || !value || Object.hasOwn(values, key)) throw new Error(usage);
    values[key] = value;
  }
  const allowed = ["--evidence-dir", "--operator", "--reviewer", "--output"];
  if (Object.keys(values).some((key) => !allowed.includes(key)) || allowed.some((key) => !values[key])) throw new Error(usage);
  if (!path.isAbsolute(values["--evidence-dir"]) || !path.isAbsolute(values["--output"])) throw new Error(usage);
  return {
    evidenceDir: values["--evidence-dir"],
    operator: values["--operator"],
    reviewer: values["--reviewer"],
    output: values["--output"],
  };
}

function normalizedIdentity(value, label) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} wajib diisi`);
  return normalized;
}

export async function buildSelfhostedUatChecklist(options, now = new Date()) {
  if (!path.isAbsolute(options.evidenceDir) || !path.isAbsolute(options.output)) {
    throw new Error("Evidence dir dan output wajib path absolut");
  }
  const operator = normalizedIdentity(options.operator, "Operator");
  const reviewer = normalizedIdentity(options.reviewer, "Reviewer");
  if (operator.toLocaleLowerCase("en-US") === reviewer.toLocaleLowerCase("en-US")) {
    throw new Error("Operator dan reviewer wajib berbeda");
  }

  const directoryInfo = await lstat(options.evidenceDir);
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) throw new Error("Evidence dir wajib direktori biasa non-symlink");
  const evidenceRoot = await realpath(options.evidenceDir);
  const outputDirectory = await realpath(path.dirname(options.output));
  if (outputDirectory !== evidenceRoot) throw new Error("Output wajib berada langsung dalam evidence dir");
  const outputPath = path.join(evidenceRoot, path.basename(options.output));

  const directoryEntries = await readdir(evidenceRoot, { withFileTypes: true });
  const jsonEntries = directoryEntries.filter((entry) => entry.name.toLowerCase().endsWith(".json") &&
    path.join(evidenceRoot, entry.name) !== outputPath && !KNOWN_NON_EVIDENCE_JSON.has(entry.name));
  if (jsonEntries.length !== REQUIRED_UAT_EVIDENCE.length) {
    throw new Error(`Evidence JSON wajib tepat ${REQUIRED_UAT_EVIDENCE.length}, ditemukan ${jsonEntries.length}`);
  }

  const evidenceByKind = new Map();
  for (const directoryEntry of jsonEntries) {
    const evidencePath = path.join(evidenceRoot, directoryEntry.name);
    const info = await lstat(evidencePath);
    if (!directoryEntry.isFile() || !info.isFile() || info.isSymbolicLink()) {
      throw new Error(`Evidence ${directoryEntry.name} wajib file biasa non-symlink`);
    }
    const content = await readFile(evidencePath);
    let report;
    try {
      report = JSON.parse(content.toString("utf8"));
    } catch {
      throw new Error(`Evidence ${directoryEntry.name} bukan JSON valid`);
    }
    const kind = report?.gate;
    if (!REQUIRED_UAT_EVIDENCE.includes(kind)) throw new Error(`Gate evidence tidak dikenal: ${kind ?? directoryEntry.name}`);
    if (evidenceByKind.has(kind)) throw new Error(`Gate evidence ${kind} wajib unik`);
    evidenceByKind.set(kind, {
      kind,
      path: evidencePath,
      sizeBytes: content.length,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  }
  for (const kind of REQUIRED_UAT_EVIDENCE) {
    if (!evidenceByKind.has(kind)) throw new Error(`Evidence ${kind} tidak ditemukan`);
  }

  const checklist = {
    schemaVersion: 1,
    target: "production",
    operator,
    reviewer,
    evidence: REQUIRED_UAT_EVIDENCE.map((kind) => evidenceByKind.get(kind)),
  };
  const temporaryPath = path.join(evidenceRoot, `.${path.basename(outputPath)}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`);
  await writeFile(temporaryPath, `${JSON.stringify(checklist, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  try {
    await chmod(temporaryPath, 0o600);
    const decision = await evaluateSelfhostedUatGate(temporaryPath, now);
    if (decision.decision !== "GO") throw new Error("Evaluator tidak menghasilkan GO");
    await rename(temporaryPath, outputPath);
    await chmod(outputPath, 0o600);
    return { output: outputPath, checklist, decision };
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) console.log(usage);
    else {
      const result = await buildSelfhostedUatChecklist(options);
      console.log(JSON.stringify({ output: result.output, ...result.decision }, null, 2));
    }
  } catch (error) {
    console.error(`NO-GO: ${error.message}`);
    process.exitCode = 1;
  }
}
