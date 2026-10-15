import { pathToFileURL } from "node:url";
import path from "node:path";
import pg from "pg";
import { hashPassword } from "../src/auth/password.mjs";

const CONFIRMATION = "bootstrap-initial-super-admin";

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
  return { databaseUrl, email, password };
}

export async function bootstrapSuperAdmin(client, { email, password }) {
  const passwordHash = await hashPassword(password);
  await client.query("begin");
  try {
    await client.query("select pg_advisory_xact_lock(hashtextextended('academy-bootstrap-super-admin',0))");
    const existing = await client.query(`select 1 from utero_academy.user_roles assignments
      join utero_academy.roles roles on roles.id = assignments.role_id
      where roles.code = 'super_admin' limit 1`);
    if (existing.rowCount) throw new Error("Super-admin sudah tersedia; bootstrap ditolak");
    const user = (await client.query(
      "select id from auth.users where lower(email)=$1 and deleted_at is null for update",
      [email],
    )).rows[0];
    if (!user) throw new Error("Email bootstrap belum ada pada hasil migrasi profile");
    const assigned = await client.query(`insert into utero_academy.user_roles(user_id,role_id)
      select $1,id from utero_academy.roles where code='super_admin' and is_assignable returning id`, [user.id]);
    if (!assigned.rowCount) throw new Error("Role super_admin tidak tersedia atau tidak assignable");
    await client.query("update auth.users set encrypted_password=$2,email_confirmed_at=now(),updated_at=now() where id=$1", [user.id, passwordHash]);
    await client.query("update auth.identities set identity_data=jsonb_set(identity_data,'{email_verified}','true'::jsonb,true),updated_at=now() where user_id=$1 and provider='email'", [user.id]);
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
