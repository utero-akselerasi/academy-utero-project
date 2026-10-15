import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { resolveObjectFile } from "../src/storage/path.mjs";

export const STORAGE_BUCKETS = [
  "avatars", "academy-private", "selection-answers", "daily-report", "task", "certificate",
  "learning", "gallery", "article", "mentor", "school-logo",
];

const AUTH_DATASETS = {
  users: {
    table: "users",
    columns: ["id", "instance_id", "aud", "role", "email", "encrypted_password", "email_confirmed_at",
      "raw_app_meta_data", "raw_user_meta_data", "last_sign_in_at", "banned_until", "deleted_at", "created_at", "updated_at"],
  },
  identities: {
    table: "identities",
    columns: ["id", "user_id", "provider_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at"],
  },
};

const EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const EVIDENCE_FILES = Object.freeze({
  migrationVerification: "migration-verification.json",
  storageVerification: "storage-verification.json",
});

function requiredEnvironment(environment, name) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} wajib diisi`);
  return value;
}

export function resolveVerificationConfig(environment = process.env) {
  const target = environment.MIGRATION_VERIFY_TARGET?.trim() || "uat";
  if (!new Set(["uat", "production"]).has(target)) {
    throw new Error("MIGRATION_VERIFY_TARGET wajib uat atau production");
  }
  const evidenceRoot = requiredEnvironment(environment, "OPS_EVIDENCE_ROOT");
  if (!path.isAbsolute(evidenceRoot)) throw new Error("OPS_EVIDENCE_ROOT wajib path absolut");
  return {
    sourceUrl: requiredEnvironment(environment, "SOURCE_DATABASE_URL"),
    targetUrl: requiredEnvironment(environment, "TARGET_DATABASE_URL"),
    sourceStorageRoot: requiredEnvironment(environment, "SOURCE_STORAGE_ROOT"),
    targetStorageRoot: requiredEnvironment(environment, "TARGET_STORAGE_ROOT"),
    target,
    evidenceRoot: path.resolve(evidenceRoot),
  };
}

export function databaseIdentity(connectionString) {
  const connection = new URL(connectionString);
  if (!new Set(["postgres:", "postgresql:"]).has(connection.protocol)) {
    throw new Error("Database URL wajib memakai postgres:// atau postgresql://");
  }
  return JSON.stringify({
    host: connection.hostname.toLowerCase(),
    port: connection.port || "5432",
    database: decodeURIComponent(connection.pathname.replace(/^\//, "")),
  });
}

export function assertDistinctDatabases(sourceUrl, targetUrl) {
  if (databaseIdentity(sourceUrl) === databaseIdentity(targetUrl)) {
    throw new Error("Source dan target tidak boleh sama");
  }
}

export function safeIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error(`Identifier tidak aman: ${value}`);
  return `"${value}"`;
}

function qualified(schema, table) {
  return `${safeIdentifier(schema)}.${safeIdentifier(table)}`;
}

export function buildChecksumQuery(schema, table, columns) {
  if (!columns.length) throw new Error(`Tabel tanpa kolom tidak dapat diverifikasi: ${schema}.${table}`);
  const values = columns.map((column) => `t.${safeIdentifier(column)}`).join(", ");
  return `select count(*)::bigint row_count,
      encode(sha256(convert_to(coalesce(string_agg(row_hash, '' order by row_hash), ''), 'UTF8')), 'hex') checksum
    from (
      select encode(sha256(convert_to(jsonb_build_array(${values})::text, 'UTF8')), 'hex') row_hash
      from ${qualified(schema, table)} t
    ) rows`;
}

async function academyTables(client) {
  return (await client.query(
    "select tablename from pg_tables where schemaname = 'utero_academy' order by tablename",
  )).rows.map((row) => row.tablename);
}

async function tableColumns(client, schema, table) {
  return (await client.query(
    `select column_name from information_schema.columns
      where table_schema = $1 and table_name = $2 order by ordinal_position`,
    [schema, table],
  )).rows.map((row) => row.column_name);
}

async function checksum(client, schema, table, columns) {
  const result = await client.query(buildChecksumQuery(schema, table, columns));
  return result.rows[0];
}

async function tableChecksums(source, target) {
  const [sourceTables, targetTables] = await Promise.all([academyTables(source), academyTables(target)]);
  const targetSet = new Set(targetTables);
  const result = {};
  const missingTables = sourceTables.filter((table) => !targetSet.has(table));
  for (const table of sourceTables) {
    if (!targetSet.has(table)) continue;
    const [sourceColumns, targetColumns] = await Promise.all([
      tableColumns(source, "utero_academy", table),
      tableColumns(target, "utero_academy", table),
    ]);
    const targetColumnSet = new Set(targetColumns);
    const missingColumns = sourceColumns.filter((column) => !targetColumnSet.has(column));
    if (missingColumns.length) {
      result[table] = { missingColumns };
      continue;
    }
    const [sourceDigest, targetDigest] = await Promise.all([
      checksum(source, "utero_academy", table, sourceColumns),
      checksum(target, "utero_academy", table, sourceColumns),
    ]);
    result[table] = { source: sourceDigest, target: targetDigest };
  }
  return { result, missingTables };
}

async function authChecksums(source, target) {
  const result = {};
  for (const [name, dataset] of Object.entries(AUTH_DATASETS)) {
    const [sourceDigest, targetDigest] = await Promise.all([
      checksum(source, "auth", dataset.table, dataset.columns),
      checksum(target, "auth", dataset.table, dataset.columns),
    ]);
    result[name] = { source: sourceDigest, target: targetDigest };
  }
  return result;
}

async function roleMatrix(client) {
  return (await client.query(`select r.code, r.is_assignable, coalesce(array_agg(p.code order by p.code) filter (where p.code is not null), '{}') permissions
    from utero_academy.roles r
    left join utero_academy.role_permissions rp on rp.role_id = r.id
    left join utero_academy.permissions p on p.id = rp.permission_id
    group by r.code, r.is_assignable order by r.code`)).rows;
}

async function sourceStorage(client) {
  return (await client.query(`select bucket_id, name,
      case
        when owner is not null and nullif(owner_id, '') is not null and lower(owner::text) <> lower(owner_id) then '__owner_conflict__'
        else coalesce(owner::text, nullif(owner_id, ''))
      end owner_id,
      coalesce(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint end, -1)::bigint byte_size
    from storage.objects
    where bucket_id = any($1::text[])
    order by bucket_id, name`, [STORAGE_BUCKETS])).rows;
}

async function targetStorage(client) {
  return (await client.query(`select bucket_id, name, owner_id::text, byte_size::bigint
    from academy_storage.objects
    where deleted_at is null and bucket_id = any($1::text[])
    order by bucket_id, name`, [STORAGE_BUCKETS])).rows;
}

async function fileDigest(file) {
  const metadata = await lstat(file);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("bukan file reguler");
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of createReadStream(file)) {
    hash.update(chunk);
    size += chunk.length;
  }
  return { size: String(size), sha256: hash.digest("hex") };
}

export async function verifyStorageBytes(rows, sourceRoot, targetRoot) {
  const failures = [];
  for (const row of rows) {
    let source;
    let target;
    try {
      source = await fileDigest(resolveObjectFile(path.resolve(sourceRoot), row.bucket_id, row.name).target);
    } catch {
      failures.push(`source_storage_file:${row.bucket_id}/${row.name}`);
      continue;
    }
    try {
      target = await fileDigest(resolveObjectFile(path.resolve(targetRoot), row.bucket_id, row.name).target);
    } catch {
      failures.push(`target_storage_file:${row.bucket_id}/${row.name}`);
      continue;
    }
    if (source.size !== String(row.byte_size) || target.size !== String(row.byte_size) || source.sha256 !== target.sha256) {
      failures.push(`storage_bytes:${row.bucket_id}/${row.name}`);
    }
  }
  return failures;
}

async function foreignKeys(client) {
  return (await client.query(`select con.conname constraint_name,
      child_ns.nspname child_schema, child.relname child_table,
      parent_ns.nspname parent_schema, parent.relname parent_table,
      array_agg(child_att.attname::text order by key.ordinality)::text[] child_columns,
      array_agg(parent_att.attname::text order by key.ordinality)::text[] parent_columns,
      con.convalidated
    from pg_constraint con
    join pg_class child on child.oid = con.conrelid
    join pg_namespace child_ns on child_ns.oid = child.relnamespace
    join pg_class parent on parent.oid = con.confrelid
    join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
    join lateral unnest(con.conkey, con.confkey) with ordinality key(child_num, parent_num, ordinality) on true
    join pg_attribute child_att on child_att.attrelid = child.oid and child_att.attnum = key.child_num
    join pg_attribute parent_att on parent_att.attrelid = parent.oid and parent_att.attnum = key.parent_num
    where con.contype = 'f' and child_ns.nspname in ('auth', 'utero_academy', 'academy_storage')
    group by con.oid, child_ns.nspname, child.relname, parent_ns.nspname, parent.relname
    order by child_ns.nspname, child.relname, con.conname`)).rows;
}

export function buildOrphanQuery(foreignKey) {
  const childColumns = foreignKey.child_columns;
  const parentColumns = foreignKey.parent_columns;
  if (!Array.isArray(childColumns) || childColumns.length === 0 || childColumns.length !== parentColumns?.length) {
    throw new Error(`Foreign key tidak valid: ${foreignKey.constraint_name}`);
  }
  const populated = childColumns.map((column) => `c.${safeIdentifier(column)} is not null`).join(" and ");
  const joined = childColumns.map((column, index) =>
    `p.${safeIdentifier(parentColumns[index])} = c.${safeIdentifier(column)}`).join(" and ");
  return `select count(*)::bigint orphan_count from ${qualified(foreignKey.child_schema, foreignKey.child_table)} c
    where ${populated} and not exists (
      select 1 from ${qualified(foreignKey.parent_schema, foreignKey.parent_table)} p where ${joined}
    )`;
}

async function foreignKeyAudit(client) {
  const constraints = await foreignKeys(client);
  const result = [];
  for (const constraint of constraints) {
    const orphan = await client.query(buildOrphanQuery(constraint));
    result.push({
      constraint: `${constraint.child_schema}.${constraint.child_table}.${constraint.constraint_name}`,
      validated: constraint.convalidated,
      orphanCount: orphan.rows[0].orphan_count,
    });
  }
  return result;
}

function equal(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function evaluateSnapshots(sourceSnapshot, targetSnapshot) {
  const failures = [];
  for (const table of sourceSnapshot.tables.missingTables) failures.push(`missing_table:${table}`);
  for (const [table, state] of Object.entries(sourceSnapshot.tables.result)) {
    if (state.missingColumns?.length) failures.push(`missing_columns:${table}`);
    else if (!equal(state.source, state.target)) failures.push(`table_checksum:${table}`);
  }
  for (const [name, state] of Object.entries(sourceSnapshot.auth)) {
    if (!equal(state.source, state.target)) failures.push(`auth_checksum:${name}`);
  }
  if (!equal(sourceSnapshot.roles, targetSnapshot.roles)) failures.push("role_permission_matrix");
  if (!equal(sourceSnapshot.files, targetSnapshot.files)) failures.push("storage_manifest");
  for (const [side, checks] of [["source", sourceSnapshot.foreignKeys], ["target", targetSnapshot.foreignKeys]]) {
    for (const check of checks) {
      if (!check.validated) failures.push(`${side}_fk_not_validated:${check.constraint}`);
      if (check.orphanCount !== "0") failures.push(`${side}_fk_orphan:${check.constraint}`);
    }
  }
  return failures;
}

export async function verifyMigration({ source, target, sourceStorageRoot, targetStorageRoot }) {
  const tables = await tableChecksums(source, target);
  const auth = await authChecksums(source, target);
  const [sourceState, targetState] = await Promise.all([
    (async () => ({
      roles: await roleMatrix(source),
      files: await sourceStorage(source),
      foreignKeys: await foreignKeyAudit(source),
    }))(),
    (async () => ({
      roles: await roleMatrix(target),
      files: await targetStorage(target),
      foreignKeys: await foreignKeyAudit(target),
    }))(),
  ]);
  const sourceSnapshot = { tables, auth, ...sourceState };
  const targetSnapshot = targetState;
  const failures = evaluateSnapshots(sourceSnapshot, targetSnapshot);
  const storageByteFailures = [];
  if (sourceStorageRoot && targetStorageRoot) {
    storageByteFailures.push(...await verifyStorageBytes(sourceState.files, sourceStorageRoot, targetStorageRoot));
    failures.push(...storageByteFailures);
  }
  const tableCount = Object.keys(tables.result).length;
  const foreignKeysChecked = sourceState.foreignKeys.length + targetState.foreignKeys.length;
  if (tableCount === 0) failures.push("no_tables_checked");
  if (foreignKeysChecked === 0) failures.push("no_foreign_keys_checked");
  const storageFailures = failures.filter((failure) =>
    failure === "storage_manifest" || failure.startsWith("source_storage_file:") ||
    failure.startsWith("target_storage_file:") || failure.startsWith("storage_bytes:"));
  const migrationFailures = failures.filter((failure) => !storageFailures.includes(failure));
  return {
    ok: failures.length === 0,
    failures,
    migrationFailures,
    storageFailures,
    tableCount,
    authUsers: auth.users.target.row_count,
    storageObjects: targetState.files.length,
    storageBytesChecked: sourceStorageRoot && targetStorageRoot
      ? sourceState.files.length - storageByteFailures.length
      : 0,
    foreignKeysChecked,
  };
}

export function buildEvidenceReports(summary, target, now = new Date()) {
  const finishedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + EVIDENCE_MAX_AGE_MS).toISOString();
  return {
    migrationVerification: {
      gate: "migrationVerification",
      target,
      status: summary.migrationFailures.length === 0 ? "PASS" : "FAIL",
      finishedAt,
      expiresAt,
      failures: summary.migrationFailures,
      tableCount: summary.tableCount,
      foreignKeysChecked: summary.foreignKeysChecked,
      authUsers: summary.authUsers,
    },
    storageVerification: {
      gate: "storageVerification",
      target,
      status: summary.storageFailures.length === 0 && summary.storageBytesChecked === summary.storageObjects ? "PASS" : "FAIL",
      finishedAt,
      expiresAt,
      failures: summary.storageFailures,
      storageObjects: summary.storageObjects,
      storageBytesChecked: summary.storageBytesChecked,
    },
  };
}

export async function writeEvidenceReports(reports, evidenceRoot) {
  if (!path.isAbsolute(evidenceRoot)) throw new Error("Direktori evidence wajib path absolut");
  await mkdir(evidenceRoot, { recursive: true });
  const written = {};
  for (const [kind, report] of Object.entries(reports)) {
    const output = path.join(evidenceRoot, EVIDENCE_FILES[kind]);
    const temporary = `${output}.${process.pid}.${kind}.tmp`;
    const content = `${JSON.stringify(report, null, 2)}\n`;
    try {
      await writeFile(temporary, content, { mode: 0o600 });
      await rename(temporary, output);
    } catch (error) {
      await unlink(temporary).catch(() => {});
      throw error;
    }
    written[kind] = output;
  }
  return written;
}

async function main() {
  const config = resolveVerificationConfig();
  assertDistinctDatabases(config.sourceUrl, config.targetUrl);
  const { sourceUrl, targetUrl, sourceStorageRoot, targetStorageRoot } = config;
  const source = new pg.Client({ connectionString: sourceUrl, options: "-c default_transaction_read_only=on" });
  const target = new pg.Client({ connectionString: targetUrl, options: "-c default_transaction_read_only=on" });
  await Promise.all([source.connect(), target.connect()]);
  try {
    const summary = await verifyMigration({ source, target, sourceStorageRoot, targetStorageRoot });
    const reports = buildEvidenceReports(summary, config.target);
    const evidence = await writeEvidenceReports(reports, config.evidenceRoot);
    console.log(JSON.stringify({ ok: summary.ok, target: config.target, evidence }));
    if (!summary.ok || Object.values(reports).some((report) => report.status !== "PASS")) process.exitCode = 1;
  } finally {
    await Promise.all([source.end(), target.end()]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
