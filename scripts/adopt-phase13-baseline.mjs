#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = join(repository, "supabase", "migrations");
const versionPattern = /^(\d{4}[a-z]?)_.+\.sql$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const catalogQueryVersion = "phase13-baseline-catalog-v1";
const baselineAdoptionWriteEnabled = false;
export const REVIEW_DECISION_COUNTS = Object.freeze({
  columns: 7, functions: 7, policies: 4, effectiveGrants: 89,
  defaultGrants: 24, storagePolicies: 32, storageBuckets: 24,
});

export const CATALOG_QUERIES = Object.freeze({
  relations: "SELECT c.relkind, c.relname, c.relpersistence, c.relrowsecurity, c.relforcerowsecurity, COALESCE(pg_get_viewdef(c.oid, true), '') AS definition FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='utero_academy' AND c.relkind IN ('r','p','v','m','S') ORDER BY 1,2",
  columns: "SELECT table_name, column_name, ordinal_position, data_type, udt_schema, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema='utero_academy' ORDER BY table_name,ordinal_position",
  constraints: "SELECT c.conname, c.contype, c.conrelid::regclass::text AS relation, pg_get_constraintdef(c.oid, true) AS definition FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='utero_academy' ORDER BY 2,3,1",
  indexes: "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='utero_academy' ORDER BY 1,2",
  functions: "SELECT p.oid::regprocedure::text AS identity, p.prosecdef, p.provolatile, pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='utero_academy' ORDER BY 1",
  triggers: "SELECT n.nspname AS schema_name, c.relname, t.tgname, pg_get_triggerdef(t.oid, true) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND (n.nspname='utero_academy' OR (n.nspname='auth' AND c.relname='users')) ORDER BY 1,2,3",
  policies: "SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname='utero_academy' OR (schemaname='storage' AND tablename='objects') ORDER BY 1,2,3",
  grants: "SELECT table_schema, table_name, grantee, privilege_type, is_grantable FROM information_schema.table_privileges WHERE table_schema='utero_academy' ORDER BY 1,2,3,4",
  buckets: "SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id IN ('article','certificate','daily-report','gallery','learning','mentor','school-logo','task') ORDER BY id",
});

const digest = (value) => createHash("sha256").update(value).digest("hex");

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function fingerprintCatalog(catalog) {
  const normalized = Object.fromEntries(Object.keys(CATALOG_QUERIES).map((key) => [key, catalog[key]]));
  if (Object.values(normalized).some((rows) => !Array.isArray(rows))) throw new Error("Katalog evidence tidak lengkap");
  return digest(canonicalJson({ queryVersion: catalogQueryVersion, catalog: normalized }));
}

export function discoverHistoricalMigrations(directory = migrationsDirectory) {
  const found = readdirSync(directory).flatMap((filename) => {
    const match = versionPattern.exec(filename);
    if (!match || match[1].slice(0, 4) > "0037") return [];
    const bytes = readFileSync(join(directory, filename));
    return [{ version: match[1], filename, checksum: digest(bytes) }];
  }).sort((left, right) => left.version.localeCompare(right.version));
  if (found.length === 0) throw new Error("Migrasi historis 0001-0037 tidak ditemukan");
  if (new Set(found.map(({ version }) => version)).size !== found.length) throw new Error("Versi migrasi historis ganda");
  const missing = Array.from({ length: 37 }, (_, index) => String(index + 1).padStart(4, "0"))
    .filter((number) => !found.some(({ version }) => version.slice(0, 4) === number));
  if (missing.length) throw new Error(`Nomor migrasi historis hilang: ${missing.join(", ")}`);
  return found;
}

export function parseArgs(argv) {
  const options = { mode: "dry-run", target: null, manifestPath: null, acknowledgement: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") options.mode = "dry-run";
    else if (argument === "--apply") options.mode = "apply";
    else if (argument === "--target") options.target = argv[++index];
    else if (argument === "--manifest") options.manifestPath = argv[++index];
    else if (argument === "--ack-manifest-sha256") options.acknowledgement = argv[++index];
    else if (argument === "--help" || argument === "-h") options.mode = "help";
    else throw new Error(`Argumen tidak dikenal: ${argument}`);
  }
  if (options.mode !== "help" && (!options.target || !options.manifestPath)) {
    throw new Error("--target develop dan --manifest <evidence.json> wajib diisi");
  }
  if (options.target && options.target !== "develop") throw new Error("Baseline adoption dilarang untuk production");
  if (options.mode === "apply" && !sha256Pattern.test(options.acknowledgement ?? "")) {
    throw new Error("--apply membutuhkan --ack-manifest-sha256 <64 hex>");
  }
  return options;
}

export function validateManifest(manifest, migrations, manifestSha256, now = new Date()) {
  if (manifest?.schemaVersion !== 1 || manifest?.purpose !== "phase13-baseline-adoption") throw new Error("Format manifest evidence tidak didukung");
  if (manifest.target !== "develop") throw new Error("Manifest production atau target selain develop ditolak");
  if (manifest.baselineThrough !== "0037") throw new Error("Manifest wajib membuktikan baseline sampai 0037");
  if (!manifest.review?.approved || typeof manifest.review.reviewedBy !== "string" || !manifest.review.reviewedBy.trim() ||
    typeof manifest.review.operator !== "string" || !manifest.review.operator.trim() ||
    manifest.review.reviewedBy.trim().toLowerCase() === manifest.review.operator.trim().toLowerCase())
    throw new Error("Reviewer independen dan operator berbeda wajib diidentifikasi");
  const reviewedAt = new Date(manifest.review.reviewedAt);
  const expiresAt = new Date(manifest.review.expiresAt);
  if (!Number.isFinite(reviewedAt.getTime()) || !Number.isFinite(expiresAt.getTime()) || reviewedAt > now || expiresAt <= now) throw new Error("Masa berlaku review manifest tidak valid");
  for (const [category, expectedCount] of Object.entries(REVIEW_DECISION_COUNTS)) {
    const decisions = manifest.review.decisions?.[category];
    if (!Array.isArray(decisions) || decisions.length !== expectedCount ||
      new Set(decisions.map((entry) => entry?.id)).size !== expectedCount || decisions.some((entry) =>
        typeof entry?.id !== "string" || !entry.id.trim() ||
        !["ACCEPT_SHARED", "CORRECT_ACADEMY", "PRESERVE_RESTRICTED", "NO_ACTION_FORMAT_ONLY", "NO_ACTION_ORDINAL_ONLY"].includes(entry.disposition) ||
        typeof entry.rationale !== "string" || entry.rationale.trim().length < 10))
      throw new Error(`Keputusan reviewer ${category} harus lengkap per objek (${expectedCount})`);
  }
  if (!manifest.database || manifest.database.name !== "postgres" || manifest.database.host !== "20.20.20.173") throw new Error("Hanya identitas database develop 20.20.20.173/postgres yang diizinkan");
  if (manifest.evidence?.cleanReplay?.status !== "PASS" || !sha256Pattern.test(manifest.evidence.cleanReplay.sha256 ?? "") ||
    manifest.evidence?.curatedDiff?.status !== "REVIEWED" || !sha256Pattern.test(manifest.evidence.curatedDiff.sha256 ?? "") ||
    manifest.evidence?.rlsMatrix?.status !== "PASS" || !sha256Pattern.test(manifest.evidence.rlsMatrix.sha256 ?? "") ||
    manifest.evidence?.storageOwnership?.status !== "REVIEWED" || !sha256Pattern.test(manifest.evidence.storageOwnership.sha256 ?? "") ||
    manifest.evidence?.sharedBackup?.status !== "RESTORE_VERIFIED" || !sha256Pattern.test(manifest.evidence.sharedBackup.sha256 ?? "") ||
    manifest.evidence?.restoreDrill?.status !== "PASS" || !sha256Pattern.test(manifest.evidence.restoreDrill.sha256 ?? "")) {
    throw new Error("Bukti replay, diff, RLS, ownership Storage, backup, dan restore drill wajib diverifikasi");
  }
  if (manifest.catalog?.queryVersion !== catalogQueryVersion || !sha256Pattern.test(manifest.catalog?.sha256 ?? "")) throw new Error("Fingerprint katalog manifest tidak valid");
  if (!Array.isArray(manifest.migrations) || canonicalJson(manifest.migrations) !== canonicalJson(migrations)) throw new Error("Daftar atau checksum migrasi manifest tidak cocok dengan repository");
  return { manifestSha256, reviewedBy: manifest.review.reviewedBy.trim(), expectedCatalogSha256: manifest.catalog.sha256 };
}

export async function captureCatalog(client) {
  const catalog = {};
  for (const [name, sql] of Object.entries(CATALOG_QUERIES)) catalog[name] = (await client.query(sql)).rows;
  return catalog;
}

export async function adoptBaseline(client, manifest, migrations, evidence) {
  if (!baselineAdoptionWriteEnabled) throw new Error("Baseline adoption belum diaktifkan: review independen dan bukti restore wajib diverifikasi");
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('utero_academy.phase13_baseline_adoption'))");
    const identity = (await client.query("SELECT current_database() AS database, inet_server_addr()::text AS host, pg_is_in_recovery() AS in_recovery")).rows[0];
    if (identity.database !== manifest.database.name || identity.host !== manifest.database.host || identity.in_recovery) throw new Error("Identitas database aktif tidak cocok dengan manifest");
    const tracker = (await client.query("SELECT to_regclass('utero_academy.schema_migrations') IS NOT NULL AS present")).rows[0];
    if (tracker.present) {
      const rows = (await client.query("SELECT version, filename, checksum FROM utero_academy.schema_migrations ORDER BY version")).rows;
      if (rows.length) throw new Error("Tracker sudah berisi data; baseline adoption ditolak");
    }
    const actualFingerprint = fingerprintCatalog(await captureCatalog(client));
    if (actualFingerprint !== evidence.expectedCatalogSha256) throw new Error("Fingerprint katalog database berubah sejak review");
    await client.query("CREATE SCHEMA IF NOT EXISTS utero_academy");
    await client.query("CREATE TABLE IF NOT EXISTS utero_academy.schema_migrations (version text PRIMARY KEY, filename text NOT NULL, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now(), applied_by text NOT NULL DEFAULT current_user, duration_ms integer)");
    for (const migration of migrations) {
      await client.query("INSERT INTO utero_academy.schema_migrations (version, filename, checksum, applied_by, duration_ms) VALUES ($1,$2,$3,$4,0)", [migration.version, migration.filename, migration.checksum, `baseline-adoption:${evidence.reviewedBy}:${evidence.manifestSha256}`]);
    }
    await client.query("COMMIT");
    return { adopted: migrations.length, catalogSha256: actualFingerprint };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.mode === "help") {
    console.log("node scripts/adopt-phase13-baseline.mjs --target develop --manifest <evidence.json> [--dry-run]\n--apply belum diaktifkan: review kriptografis dan bukti restore bersama belum terverifikasi.");
    return;
  }
  if (options.mode === "apply") throw new Error("--apply dinonaktifkan sampai review independen dan bukti baseline terverifikasi");
  const manifestBytes = readFileSync(resolve(options.manifestPath));
  const manifestSha256 = digest(manifestBytes);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const migrations = discoverHistoricalMigrations();
  const evidence = validateManifest(manifest, migrations, manifestSha256);
  console.log(JSON.stringify({ mode: "dry-run", target: "develop", writes: false, manifestSha256, baselineThrough: "0037", migrations: migrations.length, expectedCatalogSha256: evidence.expectedCatalogSha256, evidenceVerifiedExternally: false }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(`Baseline adoption gagal: ${error.message}`); process.exitCode = 1; });
}
