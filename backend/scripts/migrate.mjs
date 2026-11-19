import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function migrationChecksum(sql) {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

export function migrationChecksumCandidates(sql) {
  const lf = sql.replace(/\r\n?/g, "\n");
  const finalNewlineCrLf = lf.replace(/\n$/, "\r\n");
  const trailingNewlinesCrLf = lf.replace(/\n+$/, (ending) => ending.replace(/\n/g, "\r\n"));
  return new Set([
    migrationChecksum(sql),
    migrationChecksum(lf),
    migrationChecksum(lf.replace(/\n/g, "\r\n")),
    migrationChecksum(finalNewlineCrLf),
    migrationChecksum(trailingNewlinesCrLf),
  ]);
}

async function migrate() {
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL wajib diisi");
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query(`create table if not exists public.academy_backend_migrations (
    name text primary key,
    sha256 text not null,
    applied_at timestamptz not null default now()
  )`);
  const backendEntries = (await readdir(path.join(root, "migrations"))).filter((entry) => /^\d{4}_[a-z0-9_]+\.sql$/.test(entry)).sort();
  const legacyRoot = path.resolve(root, "..", "supabase", "migrations");
  const legacyEntries = (await readdir(legacyRoot)).filter((entry) => /^\d{4}[a-z]?_.+\.sql$/.test(entry)).sort().map((entry) => `supabase/migrations/${entry}`);
  const entries = [backendEntries[0], ...legacyEntries, "supabase/seed/0001_rbac_seed.sql", ...backendEntries.slice(1)];
  for (const entry of entries) {
    const fullPath = entry.startsWith("supabase/") ? path.resolve(root, "..", entry) : path.join(root, "migrations", entry);
    const sql = await readFile(fullPath, "utf8");
    const digest = migrationChecksum(sql);
    const tracked = await client.query("select sha256 from public.academy_backend_migrations where name = $1", [entry]);
    if (tracked.rows[0]) {
      if (!migrationChecksumCandidates(sql).has(tracked.rows[0].sha256)) throw new Error(`Checksum migrasi berubah: ${entry}`);
      continue;
    }
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into public.academy_backend_migrations (name, sha256) values ($1, $2)", [entry, digest]);
      await client.query("commit");
      console.log(`Applied ${entry}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.end();
}
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await migrate();
