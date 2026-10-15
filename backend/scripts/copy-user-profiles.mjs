import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import pg from "pg";

const CONFIRMATION = "copy-user-profiles-only";

function required(environment, name) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} wajib diisi`);
  return value;
}

export function databaseIdentity(connectionString) {
  const connection = new URL(connectionString);
  if (!new Set(["postgres:", "postgresql:"]).has(connection.protocol)) throw new Error("Database URL wajib PostgreSQL");
  return `${connection.hostname.toLowerCase()}:${connection.port || "5432"}/${decodeURIComponent(connection.pathname.slice(1))}`;
}

export function resolveCopyConfig(environment = process.env) {
  const sourceUrl = required(environment, "SOURCE_DATABASE_URL");
  const targetUrl = required(environment, "TARGET_DATABASE_URL");
  if (environment.CONFIRM_USER_PROFILE_COPY !== CONFIRMATION) throw new Error(`Set CONFIRM_USER_PROFILE_COPY=${CONFIRMATION}`);
  if (databaseIdentity(sourceUrl) === databaseIdentity(targetUrl)) throw new Error("Source dan target tidak boleh sama");
  return { sourceUrl, targetUrl };
}

export function normalizeEmail(email) {
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalized || normalized.length > 320 || /[\r\n]/.test(normalized)) throw new Error("Email source tidak valid");
  return normalized;
}

export function profileForUser(row) {
  const email = normalizeEmail(row.email);
  const fullName = row.full_name?.trim();
  if (!fullName || fullName.length > 150) throw new Error("Nama profile source tidak valid");
  return {
    id: row.id,
    fullName,
    phone: row.phone || null,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function assertUniqueEmails(rows) {
  const seen = new Set();
  for (const row of rows) {
    const email = normalizeEmail(row.email);
    if (seen.has(email)) throw new Error("Email source duplikat tanpa membedakan huruf besar/kecil");
    seen.add(email);
  }
}

function checksum(values) {
  return createHash("sha256").update(JSON.stringify(values)).digest("hex");
}

async function ensureEmptyTarget(target) {
  const result = await target.query(`select
    (select count(*)::int from auth.users) users,
    (select count(*)::int from utero_academy.user_profiles) profiles,
    (select count(*)::int from utero_academy.user_roles) assignments`);
  const counts = result.rows[0];
  if (counts.users || counts.profiles || counts.assignments) {
    throw new Error("Target wajib kosong dari user, profile, dan role assignment");
  }
}

export async function copyUserProfiles(source, target) {
  const identitySql = "select current_database() || '|' || coalesce(inet_server_addr()::text, 'local') || '|' || coalesce(inet_server_port()::text, 'local') identity";
  const [sourceIdentity, targetIdentity] = await Promise.all([source.query(identitySql), target.query(identitySql)]);
  if (sourceIdentity.rows[0]?.identity === targetIdentity.rows[0]?.identity) {
    throw new Error("Source dan target mengarah ke database PostgreSQL yang sama");
  }
  await source.query("begin isolation level repeatable read read only");
  try {
    const result = await source.query(`select users.id, users.email,
        profiles.full_name, profiles.phone, profiles.avatar_path, profiles.is_active,
        profiles.created_at, profiles.updated_at
      from utero_academy.user_profiles profiles
      join auth.users users on users.id = profiles.id
      where users.deleted_at is null
      order by lower(users.email), users.id`);
    if (!result.rowCount) throw new Error("Tidak ada profile Academy pada source");
    assertUniqueEmails(result.rows);
    const profiles = result.rows.map(profileForUser);
    const avatarsCleared = result.rows.filter((row) => row.avatar_path).length;

    await target.query("begin");
    try {
      await ensureEmptyTarget(target);
      for (let index = 0; index < result.rows.length; index += 1) {
        const user = result.rows[index];
        const profile = profiles[index];
        const email = normalizeEmail(user.email);
        await target.query(
          `insert into auth.users
             (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
           values ($1,$2,null,null,$3::jsonb,$4::jsonb)`,
          [user.id, email, JSON.stringify({ provider: "email", providers: ["email"] }),
            JSON.stringify({ full_name: profile.fullName })],
        );
        await target.query(
          `insert into auth.identities
             (id, user_id, provider_id, identity_data, provider)
           values ($1,$2,$1,$3::jsonb,'email')`,
          [user.id, user.id, JSON.stringify({ sub: user.id, email, email_verified: false })],
        );
        await target.query(
          `insert into utero_academy.user_profiles
             (id, full_name, phone, avatar_path, is_active, created_at, updated_at)
           values ($1,$2,$3,null,$4,$5,$6)`,
          [profile.id, profile.fullName, profile.phone, profile.isActive, profile.createdAt, profile.updatedAt],
        );
      }
      await target.query("commit");
    } catch (error) {
      await target.query("rollback");
      throw error;
    }

    const normalizedUsers = result.rows.map((row) => [row.id, normalizeEmail(row.email)]);
    const normalizedProfiles = profiles.map((profile) => [profile.id, profile.fullName, profile.phone, profile.isActive]);
    return {
      users: result.rowCount,
      profiles: profiles.length,
      avatarsCleared,
      roleAssignmentsCopied: 0,
      domainTablesCopied: 0,
      sessionsCopied: 0,
      passwordHashesCopied: 0,
      userChecksum: checksum(normalizedUsers),
      profileChecksum: checksum(normalizedProfiles),
    };
  } finally {
    await source.query("rollback").catch(() => undefined);
  }
}

async function main() {
  const config = resolveCopyConfig();
  const source = new pg.Client({ connectionString: config.sourceUrl, options: "-c default_transaction_read_only=on" });
  const target = new pg.Client({ connectionString: config.targetUrl });
  await Promise.all([source.connect(), target.connect()]);
  try {
    console.log(JSON.stringify(await copyUserProfiles(source, target)));
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
