#!/usr/bin/env node
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { evaluateSelfhostedUatGate, REQUIRED_UAT_EVIDENCE } from "./evaluate-selfhosted-uat-gate.mjs";
import { parseEnvFile, validateSelfhostedProductionEnv } from "./validate-selfhosted-production-env.mjs";

const usage = `Ringkas kesiapan production secara read-only dan fail-closed.
  node scripts/production-readiness-summary.mjs \\
    --env-file <path-absolut> \\
    --checklist <path-absolut>

Input boleh dihilangkan untuk inspeksi bertahap, tetapi hasil tetap NO-GO.
Command tidak melakukan network, tidak mengubah file, dan tidak mencetak nilai env.`;

export function parseProductionReadinessArgs(args) {
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) return { help: true };
  if (args.length % 2 !== 0) throw new Error(usage);
  const allowed = new Set(["--env-file", "--checklist"]);
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!allowed.has(key) || !value || Object.hasOwn(values, key) || !path.isAbsolute(value)) throw new Error(usage);
    values[key] = value;
  }
  return { envFile: values["--env-file"], checklist: values["--checklist"] };
}

async function inspectEnv(envFile, validateEnv) {
  if (!envFile) return { status: "FAIL", reason: "--env-file belum diberikan" };
  const metadata = await lstat(envFile);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("Env file wajib file biasa, bukan symlink");
  const env = parseEnvFile(await readFile(envFile, "utf8"));
  const validation = await validateEnv(env);
  if (validation?.ready !== true) throw new Error("Validator env production tidak menghasilkan ready");
  return { status: "PASS", validation: "full", checks: validation.checks };
}

async function inspectEvidence(checklist, evaluateGate) {
  if (!checklist) return { status: "FAIL", expectedCount: REQUIRED_UAT_EVIDENCE.length,
    kinds: [...REQUIRED_UAT_EVIDENCE], reason: "--checklist belum diberikan" };
  const decision = await evaluateGate(checklist);
  if (decision?.decision !== "GO" || decision?.evidenceCount !== REQUIRED_UAT_EVIDENCE.length) {
    throw new Error("Evaluator evidence tidak menghasilkan GO lengkap");
  }
  return { status: "PASS", expectedCount: REQUIRED_UAT_EVIDENCE.length,
    evidenceCount: decision.evidenceCount, decision: decision.decision };
}

async function settledCheck(operation) {
  try {
    return await operation();
  } catch (error) {
    return { status: "FAIL", error: error instanceof Error ? error.message : "Pemeriksaan gagal" };
  }
}

export async function buildProductionReadinessSummary(options, dependencies = {}) {
  const checks = {
    environment: await settledCheck(() => inspectEnv(options.envFile,
      dependencies.validateEnv ?? validateSelfhostedProductionEnv)),
    evidence: await settledCheck(() => inspectEvidence(options.checklist,
      dependencies.evaluateGate ?? evaluateSelfhostedUatGate)),
  };
  const status = Object.values(checks).every((check) => check.status === "PASS") ? "PASS" : "NO-GO";
  return { status, mode: "read-only-local", networkAccess: false, checks };
}

async function main() {
  try {
    const options = parseProductionReadinessArgs(process.argv.slice(2));
    if (options.help) return console.log(usage);
    const report = await buildProductionReadinessSummary(options);
    console.log(JSON.stringify(report, null, 2));
    if (report.status !== "PASS") process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ status: "NO-GO", error: error instanceof Error ? error.message : "Pemeriksaan gagal" }));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
