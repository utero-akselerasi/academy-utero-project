import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, readdir, readFile, rename, stat, statfs, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";

const { Client } = pg;

const BACKUP_ARTIFACTS = ["database.dump", "storage.tar.gz", "storage.files.sha256", "metadata.env"];

async function hashFile(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function validBackup(directory, backupName) {
  const checksumPath = path.join(directory, "SHA256SUMS");
  const files = [...BACKUP_ARTIFACTS, "SHA256SUMS"];
  for (const name of files) {
    const info = await lstat(path.join(directory, name)).catch(() => null);
    if (!info?.isFile() || info.isSymbolicLink()) return null;
  }
  const checksumInfo = await lstat(checksumPath);
  const metadataInfo = await lstat(path.join(directory, "metadata.env"));
  if (checksumInfo.size > 1024 || metadataInfo.size > 4096) return null;
  const lines = (await readFile(checksumPath, "utf8")).split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (lines.length !== BACKUP_ARTIFACTS.length) return null;
  const expected = new Map();
  for (const line of lines) {
    const match = /^([a-f0-9]{64})  (database\.dump|storage\.tar\.gz|storage\.files\.sha256|metadata\.env)$/.exec(line);
    if (!match || expected.has(match[2])) return null;
    expected.set(match[2], match[1]);
  }
  if (BACKUP_ARTIFACTS.some((name) => !expected.has(name))) return null;
  for (const name of BACKUP_ARTIFACTS) {
    if (await hashFile(path.join(directory, name)) !== expected.get(name)) return null;
  }
  const metadata = await readFile(path.join(directory, "metadata.env"), "utf8");
  if (!metadata.split("\n").includes("BACKUP_FORMAT=1") || !metadata.split("\n").includes(`BACKUP_NAME=${backupName}`)) return null;
  const createdAt = metadata.split("\n").find((line) => line.startsWith("CREATED_AT_UTC="))?.slice("CREATED_AT_UTC=".length);
  if (!/^\d{8}T\d{6}Z$/.test(createdAt ?? "")) return null;
  const iso = `${createdAt.slice(0, 4)}-${createdAt.slice(4, 6)}-${createdAt.slice(6, 8)}T${createdAt.slice(9, 11)}:${createdAt.slice(11, 13)}:${createdAt.slice(13, 15)}Z`;
  const timestamp = Date.parse(iso);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === `${iso.slice(0, -1)}.000Z` ? timestamp : null;
}

export async function newestBackupAgeHours(root, now = Date.now()) {
  const entries = await readdir(root, { withFileTypes: true });
  const backups = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const createdAtMs = await validBackup(path.join(root, entry.name), entry.name).catch(() => null);
    if (createdAtMs !== null && createdAtMs <= now) backups.push(createdAtMs);
  }
  if (!backups.length) return null;
  return (now - Math.max(...backups)) / 3_600_000;
}

export async function freePercent(root) {
  const info = await statfs(root);
  return info.blocks === 0 ? 0 : Math.round((Number(info.bavail) / Number(info.blocks)) * 10000) / 100;
}

export async function collectHealth(options) {
  const startedAt = new Date();
  const result = { schemaVersion: 1, gate: "opsHealth", target: options.target ?? "local",
    status: "FAIL", ok: true, startedAt: startedAt.toISOString(), checks: {} };
  try {
    const response = await fetch(options.apiUrl, { signal: AbortSignal.timeout(options.timeoutMs) });
    result.checks.api = { ok: response.ok, status: response.status };
  } catch (error) {
    result.checks.api = { ok: false, error: error instanceof Error ? error.message : "request failed" };
  }
  const client = new Client({ connectionString: options.databaseUrl, connectionTimeoutMillis: options.timeoutMs });
  try {
    await client.connect();
    const probe = await client.query("select 1 value");
    result.checks.database = { ok: probe.rows[0]?.value === 1 };
  } catch (error) {
    result.checks.database = { ok: false, error: error instanceof Error ? error.message : "database failed" };
  } finally {
    await client.end().catch(() => {});
  }
  for (const [name, root] of [["storageDisk", options.storageRoot], ["backupDisk", options.backupRoot], ["offsiteDisk", options.offsiteRoot]]) {
    try {
      const available = await freePercent(root);
      result.checks[name] = { ok: available >= options.minimumFreePercent, freePercent: available };
    } catch (error) {
      result.checks[name] = { ok: false, error: error instanceof Error ? error.message : "disk failed" };
    }
  }
  try {
    const ageHours = await newestBackupAgeHours(options.backupRoot);
    result.checks.backupFreshness = { ok: ageHours !== null && ageHours <= options.maximumBackupAgeHours, ageHours };
  } catch (error) {
    result.checks.backupFreshness = { ok: false, error: error instanceof Error ? error.message : "backup failed" };
  }
  try {
    const ageHours = await newestBackupAgeHours(options.offsiteRoot);
    result.checks.offsiteBackupFreshness = { ok: ageHours !== null && ageHours <= options.maximumBackupAgeHours, ageHours };
  } catch (error) {
    result.checks.offsiteBackupFreshness = { ok: false, error: error instanceof Error ? error.message : "offsite backup failed" };
  }
  try {
    const [backup, offsite] = await Promise.all([stat(options.backupRoot), stat(options.offsiteRoot)]);
    result.checks.offsiteIsolation = { ok: backup.dev !== offsite.dev, backupDevice: backup.dev, offsiteDevice: offsite.dev };
  } catch (error) {
    result.checks.offsiteIsolation = { ok: false, error: error instanceof Error ? error.message : "offsite isolation failed" };
  }
  result.ok = Object.values(result.checks).every((check) => check.ok);
  const finishedAt = new Date();
  result.status = result.ok ? "PASS" : "FAIL";
  result.finishedAt = finishedAt.toISOString();
  result.expiresAt = new Date(finishedAt.getTime() + 10 * 60 * 1000).toISOString();
  return result;
}

export async function writeHealthReport(report, output) {
  if (!output) return;
  if (!path.isAbsolute(output)) throw new Error("OPS_HEALTH_OUTPUT wajib path absolut");
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, output);
}

async function main() {
  const required = ["DATABASE_URL"];
  for (const name of required) if (!process.env[name]) throw new Error(`${name} wajib diisi`);
  const target = process.env.OPS_HEALTH_TARGET ?? "local";
  if (!new Set(["local", "production"]).has(target)) throw new Error("OPS_HEALTH_TARGET wajib local atau production");
  const report = await collectHealth({
    target,
    apiUrl: process.env.ACADEMY_HEALTH_URL ?? "http://api:3001/health/ready",
    databaseUrl: process.env.DATABASE_URL,
    storageRoot: process.env.STORAGE_ROOT ?? "/srv/storage",
    backupRoot: process.env.BACKUP_ROOT ?? "/backups",
    offsiteRoot: process.env.OFFSITE_ROOT ?? "/offsite",
    timeoutMs: Number(process.env.OPS_HEALTH_TIMEOUT_MS ?? 5000),
    minimumFreePercent: Number(process.env.OPS_MINIMUM_FREE_PERCENT ?? 15),
    maximumBackupAgeHours: Number(process.env.OPS_MAXIMUM_BACKUP_AGE_HOURS ?? 26),
  });
  await writeHealthReport(report, process.env.OPS_HEALTH_OUTPUT);
  console.log(JSON.stringify(report));
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
