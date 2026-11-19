import assert from "node:assert/strict";
import test from "node:test";
import { bootstrapSuperAdmin, resolveBootstrapConfig } from "../scripts/bootstrap-super-admin.mjs";

test("bootstrap super-admin memerlukan konfirmasi dan password kuat", () => {
  const base = {
    DATABASE_URL: "postgres://postgres@postgres/academy",
    BOOTSTRAP_SUPER_ADMIN_EMAIL: "Admin@Example.com",
    BOOTSTRAP_SUPER_ADMIN_PASSWORD: "password-sangat-kuat",
    CONFIRM_BOOTSTRAP_SUPER_ADMIN: "bootstrap-initial-super-admin",
  };
  assert.equal(resolveBootstrapConfig(base).email, "admin@example.com");
  assert.equal(resolveBootstrapConfig(base).allowEmptyDatabase, false);
  assert.equal(resolveBootstrapConfig({ ...base, CONFIRM_EMPTY_DATABASE_BOOTSTRAP: "create-first-super-admin" }).allowEmptyDatabase, true);
  assert.throws(() => resolveBootstrapConfig({ ...base, CONFIRM_BOOTSTRAP_SUPER_ADMIN: "wrong" }), /bootstrap-initial-super-admin/);
  assert.throws(() => resolveBootstrapConfig({ ...base, BOOTSTRAP_SUPER_ADMIN_PASSWORD: "terlalu-pendek" }), /16-128/);
});

function fixture({ users = 0, profiles = 0, assignments = 0, emailExists = false } = {}) {
  const queries = [];
  const client = { async query(sql) {
    queries.push(sql);
    if (sql.includes("where roles.code = 'super_admin'")) return { rowCount: 0, rows: [] };
    if (sql.includes("select id from auth.users where lower(email)")) return { rows: emailExists ? [{ id: "11111111-1111-4111-8111-111111111111" }] : [] };
    if (sql.includes("as users") && sql.includes("as profiles")) return { rows: [{ users, profiles, assignments }] };
    if (sql.includes("insert into auth.users")) return { rows: [{ id: "11111111-1111-4111-8111-111111111111" }] };
    if (sql.includes("insert into utero_academy.user_roles")) return { rowCount: 1 };
    if (sql.includes("update auth.identities")) return { rowCount: 1 };
    return { rowCount: 1, rows: [] };
  } };
  return { client, queries };
}

const credentials = { email: "admin@example.com", password: "password-sangat-kuat" };

test("bootstrap akun pertama butuh konfirmasi ekstra dan database kosong", async () => {
  const missing = fixture();
  await assert.rejects(bootstrapSuperAdmin(missing.client, credentials), /CONFIRM_EMPTY_DATABASE_BOOTSTRAP/);
  assert.equal(missing.queries.at(-1), "rollback");
  assert.equal(missing.queries.some((sql) => sql.includes("insert into auth.users")), false);

  const existing = fixture({ users: 1 });
  await assert.rejects(bootstrapSuperAdmin(existing.client, { ...credentials, allowEmptyDatabase: true }), /tanpa akun/);
  assert.equal(existing.queries.at(-1), "rollback");
  assert.equal(existing.queries.some((sql) => sql.includes("insert into auth.users")), false);
});

test("bootstrap akun pertama atomik membuat auth, profil, identitas dan role", async () => {
  const { client, queries } = fixture();
  assert.deepEqual(await bootstrapSuperAdmin(client, { ...credentials, allowEmptyDatabase: true }), { bootstrapped: true, role: "super_admin" });
  for (const table of ["auth.users", "auth.identities", "utero_academy.user_profiles", "utero_academy.user_roles"]) {
    assert.ok(queries.some((sql) => sql.includes(`insert into ${table}`)));
  }
  assert.equal(queries.at(-1), "commit");
});

test("bootstrap email hasil migrasi tetap tidak membutuhkan flag database kosong", async () => {
  const { client, queries } = fixture({ emailExists: true });
  assert.deepEqual(await bootstrapSuperAdmin(client, credentials), { bootstrapped: true, role: "super_admin" });
  assert.equal(queries.some((sql) => sql.includes("insert into auth.users")), false);
});
