#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const REQUIRED_BUCKETS = Object.freeze(["academy-private", "article", "certificate", "daily-report", "gallery", "learning", "mentor", "school-logo", "task"]);
export const EXPECTED_LATEST_MIGRATION = "0052";

export function assessStagingSmoke(evidence) {
  const buckets = new Set(evidence?.buckets ?? []);
  const gates = {
    identity: evidence?.target === "staging" && evidence?.instance === "supabase-02" && evidence?.gateway === "127.0.0.1:8100",
    backup: evidence?.backup?.hashesVerified === true && evidence?.backup?.provenanceVerified === true && evidence?.backup?.restoredStateVerified === true,
    tracker: evidence?.tracker?.present === true && evidence?.tracker?.latest === EXPECTED_LATEST_MIGRATION && evidence?.tracker?.checksumsVerified === true,
    buckets: REQUIRED_BUCKETS.every((bucket) => buckets.has(bucket)),
    appBinding: evidence?.app?.bindingProven === true && evidence?.app?.serverRuntimeBinding === "passed",
    cleanup: evidence?.cleanup?.auth === true && evidence?.cleanup?.database === true && evidence?.cleanup?.storage === true && evidence?.cleanup?.zeroResidue === true,
  };
  const blockers = Object.entries(gates).filter(([, passed]) => !passed).map(([name]) => name);
  const allClaimed = blockers.length === 0;
  if (allClaimed) blockers.push("independentProof");
  return {
    status: allClaimed ? "EVIDENCE_CLAIMED_NOT_VERIFIED" : "NO-GO",
    gates,
    blockers,
    fixtureAllowed: false,
    smokeAllowed: false,
    e2e: evidence?.e2e ?? {},
  };
}

function safeJsonPath(value) {
  const resolved = path.resolve(value);
  const root = path.resolve("I:/DevData/TEMP");
  if (!resolved.startsWith(`${root}${path.sep}`) || path.extname(resolved).toLowerCase() !== ".json") throw new Error("Evidence/report wajib JSON di I:/DevData/TEMP");
  return resolved;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 4) throw new Error("Gunakan: node scripts/assess-phase13-staging-smoke.mjs <evidence.json> <report.json>");
    const input = safeJsonPath(process.argv[2]);
    const output = safeJsonPath(process.argv[3]);
    const report = assessStagingSmoke(JSON.parse(readFileSync(input, "utf8")));
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    process.stdout.write(`${JSON.stringify({ status: report.status, blockers: report.blockers })}\n`);
    process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`Assessment staging gagal: ${error.message}\n`);
    process.exitCode = 1;
  }
}
