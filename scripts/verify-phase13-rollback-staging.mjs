#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, lstat } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const endpoint = "http://127.0.0.1:18200";
const appOrigin = "http://127.0.0.1:3100";

export function validateRollbackConfig(env, evidence) {
  let database;
  try { database = new URL(env.SUPABASE_STAGING_DATABASE_URL); } catch { throw new Error("URL database staging tidak valid"); }
  if (env.DEPLOY_TARGET !== "staging" || env.SUPABASE_STAGING_URL !== endpoint ||
      env.NEXT_PUBLIC_APP_URL !== appOrigin || !env.SUPABASE_STAGING_SERVICE_ROLE_KEY ||
      database.protocol !== "postgres:" || database.hostname !== "127.0.0.1" ||
      database.port !== "15632" || database.pathname !== "/postgres" ||
      !database.username || !database.password || database.search || database.hash) {
    throw new Error("Target rollback wajib staging melalui tunnel dan app loopback terverifikasi");
  }
  if (evidence?.target !== "staging" || evidence.endpoint !== endpoint ||
      evidence.database !== "postgres@127.0.0.1:15632/postgres" || evidence.app !== appOrigin ||
      evidence.sourceInstance !== "supabase-02" ||
      typeof evidence.replacementInstance !== "string" ||
      !/^supabase-02-rollback-[a-z0-9-]+$/.test(evidence.replacementInstance) ||
      evidence.replacementInstance === evidence.sourceInstance ||
      !/^[a-f0-9]{64}$/.test(evidence.replacementIdentitySha256) ||
      !/^[a-f0-9]{64}$/.test(evidence.snapshotSha256) ||
      !/^[a-f0-9]{64}$/.test(evidence.storageSha256) ||
      !/^[a-f0-9]{64}$/.test(evidence.configSha256) ||
      !Number.isSafeInteger(evidence.authUsers) || evidence.authUsers < 0 ||
      !Number.isSafeInteger(evidence.academyProfiles) || evidence.academyProfiles < 0 ||
      !Number.isSafeInteger(evidence.storageObjects) || evidence.storageObjects < 0 ||
      typeof evidence.storageBucket !== "string" || !/^[a-z0-9-]+$/.test(evidence.storageBucket)) {
    throw new Error("Bukti snapshot staging tidak lengkap atau tidak cocok");
  }
  return database.href;
}

async function get(fetcher, url, headers = {}) {
  const response = await fetcher(url, { method: "GET", headers, redirect: "error", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Probe staging gagal HTTP ${response.status}`);
  return response;
}

export async function verifyRollback(env, evidence, dependencies) {
  const databaseUrl = validateRollbackConfig(env, evidence);
  const { fetcher, query } = dependencies;
  const headers = { apikey: env.SUPABASE_STAGING_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_STAGING_SERVICE_ROLE_KEY}` };
  const auth = await (await get(fetcher, `${endpoint}/auth/v1/admin/users?page=1&per_page=1`, headers)).json();
  if (!Array.isArray(auth.users) || !Number.isSafeInteger(auth.total) || auth.total !== evidence.authUsers) {
    throw new Error("Jumlah Auth tidak cocok dengan snapshot");
  }
  const profiles = await query(databaseUrl, "SELECT count(*)::int AS count FROM utero_academy.user_profiles");
  const objects = await query(databaseUrl, "SELECT count(*)::int AS count FROM storage.objects WHERE bucket_id = $1", [evidence.storageBucket]);
  if (profiles[0]?.count !== evidence.academyProfiles || objects[0]?.count !== evidence.storageObjects) {
    throw new Error("Jumlah DB/Storage tidak cocok dengan snapshot");
  }
  const buckets = await (await get(fetcher, `${endpoint}/storage/v1/bucket`, headers)).json();
  if (!Array.isArray(buckets) || !buckets.some((bucket) => bucket.id === evidence.storageBucket)) {
    throw new Error("Bucket Storage staging tidak ditemukan");
  }
  await get(fetcher, `${appOrigin}/`);
  return { ready: true, target: "staging", authUsers: auth.total, academyProfiles: profiles[0].count,
    storageObjects: objects[0].count, storageBucket: evidence.storageBucket, app: appOrigin };
}

export async function verifyArtifactDigests(evidence, files) {
  const artifacts = [
    [files.snapshot, evidence.snapshotSha256, "snapshot DB"],
    [files.storage, evidence.storageSha256, "arsip Storage"],
    [files.config, evidence.configSha256, "arsip config"],
  ];
  for (const [file, expected, label] of artifacts) {
    if (!(await lstat(file)).isFile()) throw new Error(`${label} wajib file reguler`);
    const digest = createHash("sha256").update(await readFile(file)).digest("hex");
    if (digest !== expected) throw new Error(`Checksum ${label} tidak cocok`);
  }
}

async function main() {
  if (process.argv.length !== 6) throw new Error("Gunakan: node scripts/verify-phase13-rollback-staging.mjs evidence.json snapshot.dump storage.tar config.tgz");
  const [evidenceFile, snapshotFile, storageFile, configFile] = process.argv.slice(2);
  if (!(await lstat(evidenceFile)).isFile()) throw new Error("Evidence wajib file reguler");
  const evidence = JSON.parse(await readFile(evidenceFile, "utf8"));
  validateRollbackConfig(process.env, evidence);
  await verifyArtifactDigests(evidence, { snapshot: snapshotFile, storage: storageFile, config: configFile });
  const { default: pg } = await import("pg");
  const query = async (url, sql, parameters) => {
    const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10000 });
    await client.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await client.query("SET LOCAL statement_timeout = '10s'");
      return (await client.query(sql, parameters)).rows;
    } finally { await client.query("ROLLBACK").catch(() => {}); await client.end(); }
  };
  console.log(JSON.stringify(await verifyRollback(process.env, evidence, { fetcher: fetch, query }), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(`Rollback staging NO-GO: ${error.message}`); process.exitCode = 1; });
}
