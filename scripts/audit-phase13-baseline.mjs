#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");

export function historicalMigrations(filenames = readdirSync(migrationsDirectory)) {
  const migrations = filenames.flatMap((filename) => {
    const match = /^(\d{4}[a-z]?)_.+\.sql$/.exec(filename);
    return match && match[1].slice(0, 4) <= "0037" ? [{ version: match[1], filename }] : [];
  }).sort((left, right) => left.version.localeCompare(right.version));
  if (new Set(migrations.map(({ version }) => version)).size !== migrations.length) throw new Error("Versi historis ganda");
  return migrations;
}

export function assessBaseline(migrations, snapshots) {
  const versions = migrations.map(({ version }) => version);
  const missingNumbers = Array.from({ length: 37 }, (_, index) => String(index + 1).padStart(4, "0"))
    .filter((number) => !versions.some((version) => version.slice(0, 4) === number));
  const results = snapshots.map(({ name, objects, tracking, trackerExists }) => {
    const tracked = new Map(tracking.map((row) => [row.version, row]));
    return {
      name,
      objectCount: objects.length,
      catalogDigest: createHash("sha256").update(JSON.stringify(objects)).digest("hex"),
      trackerExists: trackerExists ?? tracking !== null,
      missingTracking: versions.filter((version) => !tracked.has(version)),
      mismatchedTracking: migrations.filter(({ version, filename, checksum }) => {
        const row = tracked.get(version);
        return row && (row.filename !== filename || row.checksum !== checksum);
      }).map(({ version }) => version),
      unexpectedTracking: tracking.filter(({ version }) => version <= "0037" && !versions.includes(version)).map(({ version }) => version),
    };
  });
  return {
    missingNumbers,
    migrations: migrations.length,
    snapshots: results,
    sameCurrentCatalog: results.length === 2 && results[0].catalogDigest === results[1].catalogDigest,
    baselineProven: false,
    gap: "Snapshot saat ini dan tracker tidak membuktikan urutan atau efek historis SQL 0001–0037. Perlu replay pada clone bersih dan diff katalog terkurasi per versi sebelum baseline.",
  };
}

export async function inspectDatabase(client, name) {
  await client.query("BEGIN READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '15s'");
    const { rows: objects } = await client.query(`
      SELECT c.relkind, c.relname, c.relpersistence, c.relrowsecurity, c.relforcerowsecurity,
        COALESCE(pg_get_viewdef(c.oid, true), '') AS view_definition
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'utero_academy' AND c.relkind IN ('r','p','v','m')
      ORDER BY c.relkind, c.relname`);
    const { rows: trackingTables } = await client.query("SELECT to_regclass('utero_academy.schema_migrations') IS NOT NULL AS present");
    const tracking = trackingTables[0].present
      ? (await client.query("SELECT version, filename, checksum FROM utero_academy.schema_migrations ORDER BY version")).rows
      : [];
    return { name, objects, tracking, trackerExists: trackingTables[0].present };
  } finally {
    await client.query("ROLLBACK");
  }
}

async function main() {
  if (process.argv.length !== 2) throw new Error("Gunakan: node scripts/audit-phase13-baseline.mjs (PHASE13_CLONE_DEV_DATABASE_URL dan PHASE13_CLONE_PROD_DATABASE_URL)");
  const urls = [process.env.PHASE13_CLONE_DEV_DATABASE_URL, process.env.PHASE13_CLONE_PROD_DATABASE_URL];
  if (urls.some((url) => !url)) throw new Error("Kedua URL clone wajib diisi");
  for (const url of urls) {
    const parsed = new URL(url);
    if (!/^phase13_(current_dev|current_prod)$/.test(decodeURIComponent(parsed.pathname.slice(1)))) throw new Error("Hanya clone phase13_current_dev dan phase13_current_prod diizinkan");
    if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) throw new Error("Host harus loopback, bukan server live");
  }
  const { default: pg } = await import("pg");
  const snapshots = [];
  for (const [index, url] of urls.entries()) {
    const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10000 });
    try {
      await client.connect();
      const snapshot = await inspectDatabase(client, index === 0 ? "develop" : "production");
      snapshots.push(snapshot);
    } finally {
      await client.end();
    }
  }
  const migrations = historicalMigrations().map((migration) => ({
    ...migration,
    checksum: createHash("sha256").update(readFileSync(join(migrationsDirectory, migration.filename))).digest("hex"),
  }));
  const report = assessBaseline(migrations, snapshots);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(`Audit baseline gagal: ${error.message}`); process.exitCode = 1; });
}
