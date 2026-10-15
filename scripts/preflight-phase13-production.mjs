import { lstat, readFile, realpath } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { isAbsolute, resolve } from "node:path";
import { createHash } from "node:crypto";
import pg from "pg";
import { TARGETS, validateConfig } from "./verify-phase13-readiness.mjs";

const execFileAsync = promisify(execFile);
const REQUIRED_COUNTS = ["auth.users", "utero_academy.attendances", "utero_academy.daily_reports", "utero_academy.daily_report_attachments"];
const SQL = Object.freeze({
  data: `SELECT 'utero_academy.attendances' AS name, count(*) FROM utero_academy.attendances
    UNION ALL SELECT 'utero_academy.daily_reports', count(*) FROM utero_academy.daily_reports
    UNION ALL SELECT 'utero_academy.daily_report_attachments', count(*) FROM utero_academy.daily_report_attachments
    UNION ALL SELECT 'auth.users', count(*) FROM auth.users
    UNION ALL SELECT 'storage.objects:' || bucket_id, count(*) FROM storage.objects GROUP BY bucket_id
    ORDER BY name`,
  rls: `SELECT n.nspname || '.' || c.relname AS name, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced,
      (has_table_privilege('anon', c.oid, 'select,insert,update,delete') OR
       has_table_privilege('authenticated', c.oid, 'select,insert,update,delete')) AS app_privileged
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'utero_academy' AND c.relkind IN ('r','p') ORDER BY name`,
  policies: `SELECT schemaname || '.' || tablename AS name, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies WHERE schemaname IN ('utero_academy', 'storage') ORDER BY name, policyname`,
  buckets: `SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id`,
});

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function validateBaseline(baseline) {
  const evidence = baseline?.evidence;
  const capturedAt = Date.parse(evidence?.capturedAt);
  const reviewedAt = Date.parse(evidence?.reviewedAt);
  if (baseline?.version !== 1 || baseline?.target !== "production" || baseline?.status !== "REVIEWED" ||
      baseline?.synthetic !== false || evidence?.source !== "historical-production-clone" ||
      evidence?.cloneDatabase !== "phase13_current_prod" || evidence?.readOnlyCapture !== true ||
      typeof evidence?.sourcePath !== "string" || !isAbsolute(evidence.sourcePath) ||
      !/^[a-f0-9]{64}$/.test(evidence?.sourceSha256 ?? "") ||
      !Number.isFinite(capturedAt) || !Number.isFinite(reviewedAt) || capturedAt > reviewedAt ||
      typeof evidence?.operator !== "string" || evidence.operator.length < 2 ||
      typeof evidence?.reviewer !== "string" || evidence.reviewer.length < 2 || evidence.operator === evidence.reviewer ||
      !baseline.counts || typeof baseline.counts !== "object" ||
      Array.isArray(baseline.counts) || !REQUIRED_COUNTS.every((name) => Object.hasOwn(baseline.counts, name)) ||
      !Object.keys(baseline.counts).some((name) => name.startsWith("storage.objects:")) ||
      !Object.entries(baseline.counts).every(([name, count]) => typeof name === "string" && Number.isSafeInteger(count) && count >= 0) ||
      !["rls", "policies", "buckets"].every((key) => /^[a-f0-9]{64}$/.test(baseline[`${key}Sha256`])) ||
      !Number.isSafeInteger(baseline.minFreeKiB) || baseline.minFreeKiB <= 0) {
    throw new Error("Baseline production belum reviewed, synthetic, atau tidak lengkap/valid");
  }
  return baseline;
}

export async function verifyBaselineSource(baseline, now = new Date()) {
  validateBaseline(baseline);
  const { sourcePath, sourceSha256, reviewedAt } = baseline.evidence;
  if (Date.parse(reviewedAt) > now.getTime()) throw new Error("Waktu review baseline berada di masa depan");
  const info = await lstat(sourcePath);
  if (!info.isFile() || info.isSymbolicLink() || info.size <= 0 || info.size > 16 * 1024 * 1024 ||
      await realpath(sourcePath) !== sourcePath) throw new Error("Berkas sumber baseline tidak reguler atau tidak kanonis");
  const actualHash = createHash("sha256").update(await readFile(sourcePath)).digest("hex");
  if (actualHash !== sourceSha256) throw new Error("Hash sumber baseline tidak sesuai bukti reviewer");
  return true;
}

export async function databaseSnapshot(databaseUrl, Client = pg.Client) {
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10000, options: "-c default_transaction_read_only=on -c statement_timeout=15000" });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const snapshot = {};
    for (const [key, sql] of Object.entries(SQL)) snapshot[key] = (await client.query(sql)).rows;
    return snapshot;
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
}

export function assessPreflight(baseline, snapshot, disk) {
  validateBaseline(baseline);
  const counts = Object.fromEntries(snapshot.data.map(({ name, count }) => [name, Number(count)]));
  if (Object.keys(counts).length !== snapshot.data.length || !Object.values(counts).every(Number.isSafeInteger)) throw new Error("Snapshot data tidak valid");
  const delta = Object.fromEntries([...new Set([...Object.keys(counts), ...Object.keys(baseline.counts)])]
    .map((name) => [name, { expected: baseline.counts[name] ?? null, actual: counts[name] ?? null }]));
  const checks = {
    data: Object.values(delta).every(({ expected, actual }) => expected !== null && expected === actual),
    disk: disk.every(({ mount, freeKiB }) => ["/", "/data"].includes(mount) && Number.isSafeInteger(freeKiB) && freeKiB >= baseline.minFreeKiB) && disk.length === 2 && new Set(disk.map(({ mount }) => mount)).size === 2,
    rls: snapshot.rls.length > 0 && snapshot.rls.every(({ name, enabled, app_privileged: appPrivileged }) =>
      enabled === true || (name === "utero_academy.schema_migrations" && enabled === false && appPrivileged === false)) &&
      digest(snapshot.rls) === baseline.rlsSha256,
    policies: snapshot.policies.length > 0 && snapshot.policies.some(({ name }) => name === "storage.objects") && digest(snapshot.policies) === baseline.policiesSha256,
    buckets: snapshot.buckets.length > 0 && digest(snapshot.buckets) === baseline.bucketsSha256,
  };
  return { checks, delta, disk, catalogSha256: Object.fromEntries(["rls", "policies", "buckets"].map((key) => [key, digest(snapshot[key])])), ready: Object.values(checks).every(Boolean) };
}

export async function checkProduction(config, baseline, { fetcher = fetch, snapshot = databaseSnapshot,
  diskReader = readDisk, verifySource = verifyBaselineSource } = {}) {
  validateConfig("production", config);
  validateBaseline(baseline);
  await verifySource(baseline);
  const health = {};
  for (const route of ["/auth/v1/settings", "/rest/v1/", "/storage/v1/bucket"]) {
    const response = await fetcher(`${TARGETS.production.endpoint}${route}`, {
      method: "GET", headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` },
      redirect: "error", signal: AbortSignal.timeout(10000),
    });
    health[route] = response.status;
    if (!response.ok) throw new Error(`Service ${route} HTTP ${response.status}`);
  }
  const [data, disk] = await Promise.all([snapshot(config.databaseUrl), diskReader(config.sshUser)]);
  return { ...assessPreflight(baseline, data, disk), target: "production", health, connectivity: { database: true, ssh: true, http: true } };
}

export async function readDisk(sshUser) {
  if (!/^[a-z_][a-z0-9_-]*$/.test(sshUser ?? "")) throw new Error("SSH user wajib eksplisit dan valid");
  const { stdout } = await execFileAsync("ssh", ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "ConnectTimeout=10", `${sshUser}@${TARGETS.production.databaseHost}`, "df -Pk / /data"], { timeout: 15000 });
  const rows = stdout.trim().split(/\r?\n/).slice(1).map((line) => line.trim().split(/\s+/));
  if (rows.length !== 2 || rows.some((row) => row.length !== 6)) throw new Error("Output disk tidak lengkap");
  return rows.map((row) => ({ mount: row[5], freeKiB: Number(row[3]) }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error("Gunakan: node scripts/preflight-phase13-production.mjs <baseline.json>");
    const baseline = validateBaseline(JSON.parse(await readFile(process.argv[2], "utf8")));
    const report = await checkProduction({ endpoint: process.env.SUPABASE_PROD_URL, databaseUrl: process.env.SUPABASE_PROD_DATABASE_URL,
      serviceKey: process.env.SUPABASE_PROD_SERVICE_ROLE_KEY, sshUser: process.env.PHASE13_PROD_SSH_USER }, baseline);
    console.log(JSON.stringify(report, null, 2));
    if (!report.ready) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ ready: false, blocker: error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted database URL]") }));
    process.exitCode = 1;
  }
}
