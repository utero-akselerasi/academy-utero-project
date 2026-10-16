import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { databaseIdentity, normalizeEmail } from "./copy-user-profiles.mjs";

const EVIDENCE_LIFETIME_MS = 24 * 60 * 60 * 1000;
const TARGETS = new Set(["uat", "production"]);

function required(environment, name) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} wajib diisi`);
  return value;
}

export function resolveIdentityVerifyConfig(environment = process.env) {
  const sourceUrl = required(environment, "SOURCE_DATABASE_URL");
  const targetUrl = required(environment, "TARGET_DATABASE_URL");
  const target = environment.IDENTITY_VERIFY_TARGET?.trim() || "uat";
  if (!TARGETS.has(target)) throw new Error("IDENTITY_VERIFY_TARGET wajib uat atau production");
  if (databaseIdentity(sourceUrl) === databaseIdentity(targetUrl)) throw new Error("Source dan target tidak boleh sama");
  const output = environment.IDENTITY_VERIFY_OUTPUT?.trim() || null;
  if (output && !path.isAbsolute(output)) throw new Error("IDENTITY_VERIFY_OUTPUT wajib path absolut");
  if (target === "production" && !output) throw new Error("Production wajib menulis IDENTITY_VERIFY_OUTPUT");
  return { sourceUrl, targetUrl, target, output };
}

function timestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Timestamp profile tidak valid");
  return date.toISOString();
}

export function normalizedProfiles(rows) {
  return rows.map((row) => ({
    id: row.id,
    email: normalizeEmail(row.email),
    fullName: row.full_name?.trim(),
    phone: row.phone || null,
    isActive: row.is_active,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  })).sort((left, right) => left.email.localeCompare(right.email) || left.id.localeCompare(right.id));
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function evaluateIdentityOnlyMigration(sourceRows, targetRows, counts, target = "uat", now = new Date()) {
  const source = normalizedProfiles(sourceRows);
  const destination = normalizedProfiles(targetRows);
  const sourceChecksum = digest(source);
  const targetChecksum = digest(destination);
  const checks = {
    profileCount: source.length > 0 && source.length === destination.length && counts.users === source.length && counts.profiles === source.length,
    profileChecksum: sourceChecksum === targetChecksum,
    emailIdentities: counts.identities === source.length && counts.emailIdentities === source.length,
    noPasswordHashes: counts.passwordHashes === 0,
    noConfirmedEmails: counts.confirmedEmails === 0,
    noSessions: counts.sessions === 0,
    noRoleAssignments: counts.roleAssignments === 0,
    noDomainRows: counts.domainRows === 0,
    noStorageObjects: counts.storageObjects === 0,
    avatarsCleared: targetRows.every((row) => row.avatar_path === null),
  };
  const finishedAt = now.toISOString();
  return {
    schemaVersion: 1,
    gate: "identityOnlyMigration",
    target,
    status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    finishedAt,
    expiresAt: new Date(now.getTime() + EVIDENCE_LIFETIME_MS).toISOString(),
    checks,
    counts: { sourceProfiles: source.length, targetProfiles: destination.length, ...counts },
    checksums: { sourceProfiles: sourceChecksum, targetProfiles: targetChecksum },
  };
}

async function writeEvidence(report, output) {
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  await rename(temporary, output);
}

async function databaseFingerprint(client) {
  return (await client.query("select current_database() || '|' || coalesce(inet_server_addr()::text, 'local') || '|' || coalesce(inet_server_port()::text, 'local') identity")).rows[0]?.identity;
}

async function profileRows(client) {
  return (await client.query(`select users.id,users.email,profiles.full_name,profiles.phone,profiles.avatar_path,
      profiles.is_active,profiles.created_at,profiles.updated_at
    from utero_academy.user_profiles profiles join auth.users users on users.id=profiles.id
    where users.deleted_at is null order by lower(users.email),users.id`)).rows;
}

async function targetCounts(client) {
  const counts = (await client.query(`select
    (select count(*)::int from auth.users) users,
    (select count(*)::int from utero_academy.user_profiles) profiles,
    (select count(*)::int from auth.identities) identities,
    (select count(*)::int from auth.identities where provider='email') "emailIdentities",
    (select count(*)::int from auth.users where encrypted_password is not null) "passwordHashes",
    (select count(*)::int from auth.users where email_confirmed_at is not null) "confirmedEmails",
    ((select count(*) from auth.sessions) + (select count(*) from auth.account_invitation_tokens))::int sessions,
    (select count(*)::int from utero_academy.user_roles) "roleAssignments",
    ((select count(*) from academy_storage.objects) + (select count(*) from storage.objects))::int "storageObjects"`)).rows[0];
  const seedTables = ["roles", "permissions", "role_permissions", "user_profiles", "user_roles",
    "attendance_settings", "landing_page_settings", "badges"];
  const tables = (await client.query(`select tablename from pg_tables
    where schemaname='utero_academy' and not (tablename=any($1::text[]))`, [seedTables])).rows;
  let domainRows = 0;
  for (const { tablename } of tables) {
    const identifier = tablename.replaceAll('"', '""');
    domainRows += (await client.query(`select count(*)::int count from utero_academy."${identifier}"`)).rows[0].count;
  }
  return { ...counts, domainRows };
}

export async function verifyIdentityOnlyMigration(source, target, evidenceTarget = "uat", now = new Date()) {
  const [sourceIdentity, targetIdentity] = await Promise.all([databaseFingerprint(source), databaseFingerprint(target)]);
  if (sourceIdentity === targetIdentity) throw new Error("Source dan target mengarah ke database PostgreSQL yang sama");
  await Promise.all([source.query("begin isolation level repeatable read read only"), target.query("begin isolation level repeatable read read only")]);
  try {
    const [sourceRows, targetRows, counts] = await Promise.all([profileRows(source), profileRows(target), targetCounts(target)]);
    return evaluateIdentityOnlyMigration(sourceRows, targetRows, counts, evidenceTarget, now);
  } finally {
    await Promise.all([source.query("rollback").catch(() => undefined), target.query("rollback").catch(() => undefined)]);
  }
}

async function main() {
  const config = resolveIdentityVerifyConfig();
  const source = new pg.Client({ connectionString: config.sourceUrl, options: "-c default_transaction_read_only=on" });
  const target = new pg.Client({ connectionString: config.targetUrl, options: "-c default_transaction_read_only=on" });
  await source.connect();
  try {
    await target.connect();
    const report = await verifyIdentityOnlyMigration(source, target, config.target);
    if (config.output) await writeEvidence(report, config.output);
    console.log(JSON.stringify(report));
    if (report.status !== "PASS") process.exitCode = 1;
  } finally {
    await Promise.all([source.end(), target.end()]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.message : "Verifikasi gagal" }));
    process.exitCode = 1;
  });
}
