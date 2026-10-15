#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

export function validateFixtureGate(env, evidence) {
  if (env.DEPLOY_TARGET !== "staging" || env.SUPABASE_STAGING_URL !== "http://127.0.0.1:18100" ||
      !env.SUPABASE_STAGING_SERVICE_ROLE_KEY || !env.SUPABASE_STAGING_ANON_KEY) {
    throw new Error("Kredensial staging atau target belum valid");
  }
  if (evidence?.instance !== "supabase-02" || evidence.gateway !== "127.0.0.1:8100" ||
      evidence.database !== "supabase-02-db" || !String(evidence.volume ?? "").includes("/supabase-02/")) {
    throw new Error("Identitas supabase-02 belum terbukti");
  }
  if (evidence.serviceKeyAccepted !== true || evidence.serviceKeySource !== "supabase-02-envoy" ||
      evidence.appBinding !== "passed" || evidence.cleanup?.auth !== true || evidence.cleanup?.database !== true ||
      evidence.cleanup?.storage !== true || evidence.cleanup?.zeroResidue !== true) {
    throw new Error("Gate key, binding app, atau cleanup belum lulus");
  }
}

export function fixtureBlockers(env, evidence) {
  const blockers = [];
  if (env.DEPLOY_TARGET !== "staging" || env.SUPABASE_STAGING_URL !== "http://127.0.0.1:18100") blockers.push("target staging loopback belum valid");
  if (!env.SUPABASE_STAGING_SERVICE_ROLE_KEY || !env.SUPABASE_STAGING_ANON_KEY) blockers.push("key staging belum tersedia");
  if (evidence?.instance !== "supabase-02" || evidence.gateway !== "127.0.0.1:8100" || evidence.database !== "supabase-02-db" ||
      !String(evidence.volume ?? "").includes("/supabase-02/")) blockers.push("identitas supabase-02 belum lengkap");
  if (evidence?.serviceKeyAccepted !== true || evidence.serviceKeySource !== "supabase-02-envoy") blockers.push("service key belum terbukti berasal dan diterima supabase-02");
  if (evidence?.appBinding !== "passed") blockers.push("binding app staging belum lulus");
  if (evidence?.cleanup?.auth !== true || evidence.cleanup.database !== true || evidence.cleanup.storage !== true ||
      evidence.cleanup.zeroResidue !== true) blockers.push("cleanup Auth/DB/Storage dan zero-residue belum terbukti");
  return blockers;
}

export function buildFixturePlan(env, evidence, id = randomUUID()) {
  validateFixtureGate(env, evidence);
  const marker = `phase13-smoke-${id}`;
  return {
    marker,
    syntheticIdentity: { email: `${marker}@invalid.example`, fullName: `Synthetic ${id}` },
    storagePrefix: `phase13-smoke/${id}/`,
    createOrder: ["auth user", "user profile and applicant role", "school and school contact", "application", "selection fixture", "onboarding result", "certificate fixture"],
    cleanupOrder: ["signed URL expires", "storage objects by exact prefix", "selection/application rows by exact IDs", "certificate/onboarding rows by exact IDs", "school fixture by exact ID", "auth user by exact ID"],
    requirements: ["record every created UUID before next write", "cleanup in finally", "verify zero rows and zero objects for marker", "never use wildcard outside exact marker prefix"],
    executable: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stderr.write("Planner hanya dapat dipanggil dengan evidence tervalidasi; tidak melakukan write.\n");
  process.exitCode = 1;
}
