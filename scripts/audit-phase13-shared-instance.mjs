#!/usr/bin/env node
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { TARGETS, validateConfig } from "./verify-phase13-readiness.mjs";

export const ACADEMY_BUCKETS = Object.freeze([
  "academy-private", "article", "certificate", "daily-report", "gallery",
  "learning", "mentor", "school-logo", "task",
]);

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function assessSharedInstance(target, snapshot) {
  if (!["develop", "production"].includes(target) || snapshot?.target !== target) {
    throw new Error("Identitas shared instance tidak cocok");
  }
  const missingBuckets = ACADEMY_BUCKETS.filter((bucket) => !snapshot.academyBuckets.includes(bucket));
  const gates = {
    academySchema: snapshot.academySchema === true && snapshot.academyTables > 0,
    tracker: snapshot.trackerPresent === true,
    buckets: missingBuckets.length === 0,
    catalog: ["columns", "functions", "grants", "indexes", "policies"].every((key) =>
      Number.isInteger(snapshot.catalogCounts[key]) && snapshot.catalogCounts[key] > 0 &&
      /^[a-f0-9]{64}$/.test(snapshot.catalogSha256[key] ?? "")),
    scopedCounts: Number.isInteger(snapshot.academyUsers) && snapshot.academyUsers >= 0 &&
      Number.isInteger(snapshot.academyStorageObjects) && snapshot.academyStorageObjects >= 0,
  };
  const blockers = Object.entries(gates).filter(([, passed]) => !passed).map(([name]) => name);
  return {
    target,
    sharedInstance: true,
    status: blockers.length ? "NO-GO" : "SHARED_INSTANCE_AUDITED",
    gates,
    blockers,
    missingBuckets,
    academy: {
      users: snapshot.academyUsers,
      storageObjectsInCandidateBuckets: snapshot.academyStorageObjects,
      storageObjectOwnershipVerified: false,
      tables: snapshot.academyTables,
      functions: snapshot.academyFunctions,
      policies: snapshot.academyPolicies,
    },
    sharedContext: {
      schemas: snapshot.sharedSchemas,
      authUsersAllProjects: snapshot.globalAuthUsers,
      storageObjectsAllProjects: snapshot.globalStorageObjects,
      countsAreReadinessEvidence: false,
    },
    catalogSha256: snapshot.catalogSha256,
  };
}

export async function captureSharedInstance(target, config, Client = pg.Client) {
  if (!['develop', 'production'].includes(target)) throw new Error("Audit shared hanya untuk develop atau production");
  validateConfig(target, { ...config, serviceKey: "unused-read-only-audit" });
  const client = new Client({ connectionString: config.databaseUrl, connectionTimeoutMillis: 10000,
    options: "-c default_transaction_read_only=on -c statement_timeout=30000" });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const scalar = async (sql, parameters = []) => (await client.query(sql, parameters)).rows[0];
    const identity = await scalar("SELECT current_database() AS database, to_regnamespace('utero_academy') IS NOT NULL AS academy_schema, to_regclass('utero_academy.schema_migrations') IS NOT NULL AS tracker_present");
    const counts = await scalar("SELECT (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='utero_academy') AS academy_tables, (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='utero_academy') AS academy_functions, (SELECT count(*)::int FROM pg_policies WHERE schemaname='utero_academy') AS academy_policies, (SELECT count(DISTINCT id)::int FROM utero_academy.user_profiles) AS academy_users, (SELECT count(*)::int FROM storage.objects WHERE bucket_id = ANY($1::text[])) AS academy_storage_objects, (SELECT count(*)::int FROM auth.users) AS global_auth_users, (SELECT count(*)::int FROM storage.objects) AS global_storage_objects", [ACADEMY_BUCKETS]);
    const academyBuckets = (await client.query("SELECT id FROM storage.buckets WHERE id = ANY($1::text[]) ORDER BY id", [ACADEMY_BUCKETS])).rows.map(({ id }) => id);
    const sharedSchemas = (await client.query("SELECT nspname FROM pg_namespace WHERE nspname IN ('utero_academy','buzzerhood','soundpub') ORDER BY nspname")).rows.map(({ nspname }) => nspname);
    const catalogs = {
      columns: (await client.query("SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='utero_academy' ORDER BY table_name,column_name")).rows,
      functions: (await client.query("SELECT p.oid::regprocedure::text AS name, pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='utero_academy' ORDER BY 1")).rows,
      grants: (await client.query("SELECT table_name, grantee, privilege_type FROM information_schema.table_privileges WHERE table_schema='utero_academy' ORDER BY 1,2,3")).rows,
      indexes: (await client.query("SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='utero_academy' ORDER BY 1,2")).rows,
      policies: (await client.query("SELECT tablename, policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname='utero_academy' ORDER BY 1,2")).rows,
    };
    const snapshot = {
      target, database: identity.database, academySchema: identity.academy_schema,
      trackerPresent: identity.tracker_present,
      academyTables: counts.academy_tables,
      academyFunctions: counts.academy_functions,
      academyPolicies: counts.academy_policies,
      academyUsers: counts.academy_users,
      academyStorageObjects: counts.academy_storage_objects,
      globalAuthUsers: counts.global_auth_users,
      globalStorageObjects: counts.global_storage_objects,
      academyBuckets, sharedSchemas,
      catalogCounts: Object.fromEntries(Object.entries(catalogs).map(([key, rows]) => [key, rows.length])),
      catalogSha256: Object.fromEntries(Object.entries(catalogs).map(([key, rows]) => [key, digest(rows)])),
    };
    return assessSharedInstance(target, snapshot);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
}

async function main() {
  const target = process.argv[2];
  if (!['develop', 'production'].includes(target) || process.argv.length !== 3) {
    throw new Error("Gunakan: node scripts/audit-phase13-shared-instance.mjs develop|production");
  }
  const suffix = target === "develop" ? "DEV" : "PROD";
  const report = await captureSharedInstance(target, {
    endpoint: TARGETS[target].endpoint,
    databaseUrl: process.env[`SUPABASE_${suffix}_DATABASE_URL`],
  });
  console.log(JSON.stringify({ ...report, endpoint: TARGETS[target].endpoint }, null, 2));
  if (report.status === "NO-GO") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Shared instance audit gagal: ${error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted database URL]")}`);
    process.exitCode = 1;
  });
}
