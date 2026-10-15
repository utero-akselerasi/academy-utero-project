#!/usr/bin/env node
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";

const roles = ["intern", "school", "admin", "super_admin"];

export function validateRlsTarget(value, expectedDatabase) {
  let url;
  try { url = new URL(value); } catch { throw new Error("URL clone RLS tidak valid"); }
  const disposableDatabase = /^phase13_[a-z0-9_]*0051[a-z0-9_]*$/.test(expectedDatabase ?? "") ||
    ["phase13_live_dev_candidate53_20261013", "phase13_live_prod_20261014"].includes(expectedDatabase);
  if (!disposableDatabase ||
      !["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" ||
      url.port !== "55439" || url.username !== "supabase_admin" || url.pathname !== "/" + expectedDatabase ||
      url.search || url.hash) throw new Error("Audit RLS hanya pada clone disposable yang diizinkan di port lokal 55439");
  return url.href;
}

export function assessRlsMatrix(principals) {
  const checks = {
    anon: principals?.anon?.academyAccess === "denied",
    peserta: principals?.peserta?.own === "passed" && principals?.peserta?.crossTenant === "denied",
    sekolah: principals?.sekolah?.own === "passed" && principals?.sekolah?.crossTenant === "denied",
    mentorArea: principals?.mentorArea?.databaseRole === "admin" && principals?.mentorArea?.staffRead === "passed",
    admin: principals?.admin?.staffRead === "passed",
    superAdmin: principals?.superAdmin?.staffRead === "passed",
    profileIsolation: principals?.profileIsolation?.own === "passed" && principals?.profileIsolation?.foreign === "denied",
    roleIsolation: principals?.roleIsolation?.own === "passed" && principals?.roleIsolation?.foreign === "denied",
    directRoleWrite: principals?.directRoleWrite === "denied",
    serviceRoleGrant: principals?.serviceRoleGrant === "passed",
  };
  return { ready: Object.values(checks).every(Boolean), checks };
}

async function asRole(client, role, userId, sql, parameters = []) {
  if (!["anon", "authenticated"].includes(role)) throw new Error("Role SQL tidak diizinkan");
  await client.query("SAVEPOINT matrix_role");
  try {
    await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role })]);
    await client.query("SET LOCAL ROLE " + role);
    const context = (await client.query("select current_user as role, current_setting('request.jwt.claims', true)::jsonb->>'sub' as user_id")).rows[0];
    if (context.role !== role || context.user_id !== userId) throw new Error("Konteks role/JWT clone tidak cocok");
    const rows = (await client.query(sql, parameters)).rows;
    await client.query("ROLLBACK TO SAVEPOINT matrix_role");
    await client.query("RELEASE SAVEPOINT matrix_role");
    return { status: "passed", rows };
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT matrix_role");
    await client.query("RELEASE SAVEPOINT matrix_role");
    if (error.code === "42501") return { status: "denied", rows: [] };
    throw error;
  }
}

function count(result) { return Number(result.rows[0]?.count ?? 0); }

export async function auditRlsMatrix(databaseUrl, expectedDatabase, Client = pg.Client) {
  validateRlsTarget(databaseUrl, expectedDatabase);
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10000,
    options: "-c default_transaction_read_only=on -c statement_timeout=15000" });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const identity = (await client.query("select current_database() database, to_regclass('auth.users') is not null auth, to_regclass('storage.objects') is not null storage")).rows[0];
    if (identity.database !== expectedDatabase || !identity.auth || !identity.storage) throw new Error("Identitas clone salah");
    const rls = (await client.query("select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='utero_academy' and relname=any($1::text[]) order by relname", [["intern_profiles", "school_contacts", "user_profiles", "user_roles"]])).rows;
    if (rls.length !== 4 || rls.some((row) => row.relrowsecurity !== true)) throw new Error("RLS tabel audit tidak aktif");
    const allTables = (await client.query("select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='utero_academy' and c.relkind in ('r','p') order by relname")).rows;
    const exceptions = allTables.filter((row) => row.relrowsecurity !== true).map((row) => row.relname);
    if (exceptions.length !== 1 || exceptions[0] !== "schema_migrations") throw new Error("Tabel Academy tanpa RLS melebihi tracker internal");
    const trackerPrivileges = (await client.query("select has_table_privilege('anon','utero_academy.schema_migrations','select,insert,update,delete') anon, has_table_privilege('authenticated','utero_academy.schema_migrations','select,insert,update,delete') authenticated")).rows[0];
    if (trackerPrivileges.anon || trackerPrivileges.authenticated) throw new Error("Tracker internal memiliki privilege role aplikasi");
    const publicExecute = Number((await client.query("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='utero_academy' and has_function_privilege('public',p.oid,'execute')")).rows[0].count);
    if (publicExecute) throw new Error("PUBLIC EXECUTE Academy belum dicabut");
    const assignments = (await client.query("select r.code,min(ur.user_id::text) user_id from utero_academy.user_roles ur join utero_academy.roles r on r.id=ur.role_id where r.code=any($1::text[]) group by r.code", [roles])).rows;
    const users = Object.fromEntries(assignments.map((row) => [row.code, row.user_id]));
    if (roles.some((role) => !users[role])) throw new Error("Principal clone tidak lengkap");
    const own = (await client.query("select id::text,school_id::text from utero_academy.intern_profiles where user_id=$1 order by id limit 1", [users.intern])).rows[0];
    const other = (await client.query("select id::text from utero_academy.intern_profiles where user_id<>$1 order by id limit 1", [users.intern])).rows[0];
    const school = (await client.query("select school_id::text from utero_academy.school_contacts where user_id=$1 order by id limit 1", [users.school])).rows[0];
    const schoolIntern = (await client.query("select id::text from utero_academy.intern_profiles where school_id=$1 order by id limit 1", [school?.school_id])).rows[0];
    const foreignSchoolIntern = (await client.query("select id::text from utero_academy.intern_profiles where school_id is distinct from $1 order by id limit 1", [school?.school_id])).rows[0];
    if (!own || !other || !school || !schoolIntern || !foreignSchoolIntern) throw new Error("Fixture tenant clone tidak lengkap");
    const selectIntern = "select count(*) from utero_academy.intern_profiles where id=$1";
    const ownIntern = await asRole(client, "authenticated", users.intern, selectIntern, [own.id]);
    const crossIntern = await asRole(client, "authenticated", users.intern, selectIntern, [other.id]);
    const ownSchool = await asRole(client, "authenticated", users.school, selectIntern, [schoolIntern.id]);
    const crossSchool = await asRole(client, "authenticated", users.school, selectIntern, [foreignSchoolIntern.id]);
    const totals = await Promise.all(["user_profiles", "user_roles"].map(async (table) =>
      Number((await client.query("select count(*) from utero_academy." + table)).rows[0].count)));
    const staffRead = async (userId) => {
      const result = [];
      for (const table of ["user_profiles", "user_roles"]) {
        result.push(await asRole(client, "authenticated", userId, "select count(*) from utero_academy." + table));
      }
      return result.every((entry, index) => entry.status === "passed" && count(entry) === totals[index]) ? "passed" : "failed";
    };
    const anon = await asRole(client, "anon", "00000000-0000-0000-0000-000000000000", "select count(*) from utero_academy.user_profiles");
    const ownProfile = await asRole(client, "authenticated", users.intern, "select count(*) from utero_academy.user_profiles where id=$1", [users.intern]);
    const foreignProfile = await asRole(client, "authenticated", users.intern, "select count(*) from utero_academy.user_profiles where id=$1", [users.admin]);
    const ownRole = await asRole(client, "authenticated", users.intern, "select count(*) from utero_academy.user_roles where user_id=$1", [users.intern]);
    const foreignRole = await asRole(client, "authenticated", users.intern, "select count(*) from utero_academy.user_roles where user_id=$1", [users.admin]);
    const effectiveGrants = (await client.query(`select
      has_schema_privilege('authenticated','utero_academy','USAGE') authenticated_schema,
      has_table_privilege('authenticated','utero_academy.user_roles','INSERT') authenticated_insert,
      has_table_privilege('authenticated','utero_academy.user_roles','UPDATE') authenticated_update,
      has_table_privilege('authenticated','utero_academy.user_roles','DELETE') authenticated_delete,
      has_schema_privilege('service_role','utero_academy','USAGE') service_schema,
      has_table_privilege('service_role','utero_academy.user_roles','SELECT') service_select,
      has_table_privilege('service_role','utero_academy.user_roles','INSERT') service_insert,
      has_table_privilege('service_role','utero_academy.user_roles','DELETE') service_delete`)).rows[0];
    const principals = {
      anon: { academyAccess: anon.status },
      peserta: { own: count(ownIntern) === 1 ? "passed" : "failed", crossTenant: count(crossIntern) === 0 ? "denied" : "leaked" },
      sekolah: { own: count(ownSchool) === 1 ? "passed" : "failed", crossTenant: count(crossSchool) === 0 ? "denied" : "leaked" },
      mentorArea: { databaseRole: "admin", staffRead: await staffRead(users.admin) },
      admin: { staffRead: await staffRead(users.admin) },
      superAdmin: { staffRead: await staffRead(users.super_admin) },
      profileIsolation: { own: count(ownProfile) === 1 ? "passed" : "failed", foreign: count(foreignProfile) === 0 ? "denied" : "leaked" },
      roleIsolation: { own: count(ownRole) > 0 ? "passed" : "failed", foreign: count(foreignRole) === 0 ? "denied" : "leaked" },
      directRoleWrite: effectiveGrants.authenticated_schema && !effectiveGrants.authenticated_insert &&
        !effectiveGrants.authenticated_update && !effectiveGrants.authenticated_delete ? "denied" : "allowed",
      serviceRoleGrant: effectiveGrants.service_schema && effectiveGrants.service_select &&
        effectiveGrants.service_insert && effectiveGrants.service_delete ? "passed" : "failed",
    };
    const assessment = assessRlsMatrix(principals);
    const report = { target: "clone-disposable", database: expectedDatabase, transaction: "READ ONLY",
      academyTables: allTables.length, rlsEnabled: allTables.length - exceptions.length,
      rlsException: "schema_migrations:no-app-privileges", policyDependencyTables: rls.map((row) => row.relname),
      crossTenantTables: ["intern_profiles"],
      publicExecute, principals, ...assessment };
    return { ...report, sha256: createHash("sha256").update(JSON.stringify(report)).digest("hex") };
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  auditRlsMatrix(process.env.PHASE13_RLS_DATABASE_URL, process.env.PHASE13_RLS_EXPECTED_DATABASE)
    .then((report) => { process.stdout.write(JSON.stringify(report, null, 2) + "\n"); if (!report.ready) process.exitCode = 1; })
    .catch((error) => { process.stderr.write("RLS matrix NO-GO: " + error.message + "\n"); process.exitCode = 1; });
}
