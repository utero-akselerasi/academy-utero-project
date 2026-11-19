import { pathToFileURL } from "node:url";
import path from "node:path";
import pg from "pg";
import { hashPassword } from "../src/auth/password.mjs";

const CONFIRMATION = "bootstrap-initial-super-admin";
const EMPTY_DATABASE_CONFIRMATION = "create-first-super-admin";

function required(environment, name) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} wajib diisi`);
  return value;
}

export function resolveBootstrapConfig(environment = process.env) {
  const databaseUrl = required(environment, "DATABASE_URL");
  const email = required(environment, "BOOTSTRAP_SUPER_ADMIN_EMAIL").toLowerCase();
  const password = required(environment, "BOOTSTRAP_SUPER_ADMIN_PASSWORD");
  if (environment.CONFIRM_BOOTSTRAP_SUPER_ADMIN !== CONFIRMATION) {
    throw new Error(`Set CONFIRM_BOOTSTRAP_SUPER_ADMIN=${CONFIRMATION}`);
  }
  if (password.length < 16 || password.length > 128) throw new Error("Password bootstrap wajib 16-128 karakter");
  if (!email.includes("@") || /[\r\n]/.test(email)) throw new Error("Email bootstrap tidak valid");
  return {
    databaseUrl, email, password,
    allowEmptyDatabase: environment.CONFIRM_EMPTY_DATABASE_BOOTSTRAP === EMPTY_DATABASE_CONFIRMATION,
  };
}

export async function bootstrapSuperAdmin(client, { email, password, allowEmptyDatabase = false }) {
  const passwordHash = await hashPassword(password);
  await client.query("begin");
  try {
    await client.query("select pg_advisory_xact_lock(hashtextextended('academy-bootstrap-super-admin',0))");
    const existing = await client.query(`select 1 from utero_academy.user_roles assignments
      join utero_academy.roles roles on roles.id = assignments.role_id
      where roles.code = 'super_admin' limit 1`);
    if (existing.rowCount) throw new Error("Super-admin sudah tersedia; bootstrap ditolak");
    let user = (await client.query(
      "select id from auth.users where lower(email)=$1 and deleted_at is null for update",
      [email],
    )).rows[0];
    if (!user) {
      if (!allowEmptyDatabase) throw new Error("Email bootstrap belum ada pada hasil migrasi profile; untuk database kosong set CONFIRM_EMPTY_DATABASE_BOOTSTRAP=create-first-super-admin");
      const counts = (await client.query(`select
        (select count(*)::int from auth.users) as users,
        (select count(*)::int from utero_academy.user_profiles) as profiles,
        (select count(*)::int from utero_academy.user_roles) as assignments`)).rows[0];
      if (!counts || counts.users !== 0 || counts.profiles !== 0 || counts.assignments !== 0) {
        throw new Error("Bootstrap akun baru hanya diizinkan pada database tanpa akun, profil, atau role user");
      }
      user = (await client.query(`insert into auth.users(email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
        values($1,$2,now(),$3::jsonb,$4::jsonb) returning id`, [email, passwordHash,
        JSON.stringify({ provider: "email", providers: ["email"] }),
        JSON.stringify({ full_name: "Administrator Academy", source_app: "utero_academy" })])).rows[0];
      await client.query("insert into auth.identities(id,user_id,provider_id,identity_data,provider) values($1,$2,$1,$3::jsonb,'email')", [
        user.id, user.id, JSON.stringify({ sub: user.id, email, email_verified: true }),
      ]);
      await client.query("insert into utero_academy.user_profiles(id,full_name,is_active) values($1,$2,true)", [user.id, "Administrator Academy"]);
    }
    const assigned = await client.query(`insert into utero_academy.user_roles(user_id,role_id)
      select $1,id from utero_academy.roles where code='super_admin' and is_assignable returning id`, [user.id]);
    if (!assigned.rowCount) throw new Error("Role super_admin tidak tersedia atau tidak assignable");
    await client.query("update auth.users set encrypted_password=$2,email_confirmed_at=now(),updated_at=now() where id=$1", [user.id, passwordHash]);
    const identity = await client.query("update auth.identities set identity_data=jsonb_set(identity_data,'{email_verified}','true'::jsonb,true),updated_at=now() where user_id=$1 and provider='email'", [user.id]);
    if (identity.rowCount !== 1) throw new Error("Identitas email super-admin tidak valid");
    await client.query("commit");
    return { bootstrapped: true, role: "super_admin" };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function main() {
  const config = resolveBootstrapConfig();
  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();
  try { console.log(JSON.stringify(await bootstrapSuperAdmin(client, config))); }
  finally { await client.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
