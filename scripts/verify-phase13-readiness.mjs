#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";

export const TARGETS = Object.freeze({
  develop: { endpoint: "https://supabase.carubra.com", databaseHost: "20.20.20.173" },
  production: { endpoint: "https://supabase.carubra.space", databaseHost: "20.20.20.3" },
  staging: { endpoint: "http://127.0.0.1:18100", databaseHost: "127.0.0.1" },
});
export const REQUIRED_BUCKETS = Object.freeze(["academy-private", "daily-report", "task", "certificate", "learning", "gallery", "article", "mentor", "school-logo"]);

export function repositoryMigrationVersions(filenames) {
  const versions = filenames.flatMap((filename) => {
    const match = /^(\d{4}[a-z]?)_.+\.sql$/.exec(filename);
    return match ? [match[1]] : [];
  }).sort();
  if (!versions.length || new Set(versions).size !== versions.length) throw new Error("Daftar migrasi repo kosong atau memiliki versi ganda");
  return versions;
}

function readRepositoryVersions() {
  const directory = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
  return repositoryMigrationVersions(readdirSync(directory));
}

export function validateConfig(target, config) {
  const expected = TARGETS[target];
  if (!expected) throw new Error("Target harus develop, production, atau staging");
  if (!config?.endpoint || !config?.databaseUrl || !config?.serviceKey) throw new Error("Endpoint, database URL, dan service-role key wajib tersedia");
  let endpoint;
  let database;
  try {
    endpoint = new URL(config.endpoint);
    database = new URL(config.databaseUrl);
  } catch {
    throw new Error("URL target atau database tidak valid");
  }
  if (endpoint.href !== `${expected.endpoint}/`) throw new Error("Endpoint tidak sesuai target");
  if (!["postgres:", "postgresql:"].includes(database.protocol) || database.hostname !== expected.databaseHost || !database.username || !database.password || !database.pathname || database.pathname === "/") throw new Error("Database URL tidak sesuai target atau tidak lengkap");
  if (target === "staging" && (database.port !== "15532" || database.pathname !== "/postgres" || database.search || database.hash)) throw new Error("Database URL staging tidak sesuai target");
  return expected;
}

export async function checkReadiness(target, config, { fetcher, queryMigrationTracker, expectedVersions = readRepositoryVersions() }) {
  const expected = validateConfig(target, config);
  if (!expectedVersions.length || new Set(expectedVersions).size !== expectedVersions.length || !expectedVersions.every((version) => /^\d{4}[a-z]?$/.test(version))) throw new Error("Daftar migrasi repo tidak valid");
  const orderedExpectedVersions = [...expectedVersions].sort();
  const headers = { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` };
  const responses = [];
  for (const route of ["/auth/v1/admin/users?page=1&per_page=1", "/storage/v1/bucket"]) {
    const response = await fetcher(`${expected.endpoint}${route}`, { method: "GET", headers, redirect: "error", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Endpoint ${route} HTTP ${response.status}`);
    responses.push(response);
  }
  const auth = await responses[0].json();
  if (!auth || !Array.isArray(auth.users)) throw new Error("Respons Auth Admin tidak valid");
  const buckets = await responses[1].json();
  if (!Array.isArray(buckets)) throw new Error("Respons bucket tidak valid");
  const bucketNames = new Set(buckets.map((bucket) => bucket.id));
  const missingBuckets = REQUIRED_BUCKETS.filter((name) => !bucketNames.has(name));
  const tracker = await queryMigrationTracker(config.databaseUrl);
  if (!tracker || typeof tracker.exists !== "boolean" || !Array.isArray(tracker.versions)) throw new Error("Respons migration tracker tidak valid");
  const versions = tracker.versions;
  if (!Array.isArray(versions) || !versions.every((version) => typeof version === "string")) throw new Error("Respons schema version tidak valid");
  const latestVersion = versions.at(-1) ?? null;
  const expectedLatestVersion = orderedExpectedVersions.at(-1);
  const missingVersions = orderedExpectedVersions.filter((version) => !versions.includes(version));
  const unexpectedVersions = versions.filter((version) => !orderedExpectedVersions.includes(version));
  return { target, endpoint: expected.endpoint, databaseHost: expected.databaseHost, authAdminReadable: true, migrationTrackerExists: tracker.exists, latestVersion, expectedLatestVersion, missingVersions, unexpectedVersions, missingBuckets, ready: tracker.exists && missingBuckets.length === 0 && missingVersions.length === 0 && unexpectedVersions.length === 0 && latestVersion === expectedLatestVersion };
}

async function queryTracker(databaseUrl) {
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '10s'");
    const { rows: presence } = await client.query("SELECT to_regclass('utero_academy.schema_migrations') IS NOT NULL AS present");
    if (!presence[0].present) return { exists: false, versions: [] };
    const { rows } = await client.query("SELECT version FROM utero_academy.schema_migrations ORDER BY version");
    return { exists: true, versions: rows.map((row) => row.version) };
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
}

async function main() {
  const [, , target, ...options] = process.argv;
  if (options.length || !TARGETS[target]) throw new Error("Gunakan: node scripts/verify-phase13-readiness.mjs develop|production|staging");
  const suffix = target === "develop" ? "DEV" : target === "production" ? "PROD" : "STAGING";
  const config = { endpoint: process.env[`SUPABASE_${suffix}_URL`], databaseUrl: process.env[`SUPABASE_${suffix}_DATABASE_URL`], serviceKey: process.env[`SUPABASE_${suffix}_SERVICE_ROLE_KEY`] };
  const report = await checkReadiness(target, config, { fetcher: fetch, queryMigrationTracker: queryTracker });
  console.log(JSON.stringify(report, null, 2));
  if (!report.ready) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Readiness gagal: ${error.message}`);
    process.exitCode = 1;
  });
}
