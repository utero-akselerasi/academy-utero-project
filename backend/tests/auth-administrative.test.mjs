import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { authRoutes } from "../src/routes/auth.mjs";
import { superAdminRoutes } from "../src/routes/super-admin.mjs";
import { inviteAccount } from "../src/auth/invitation.mjs";

test("undangan menolak kontak tidak valid tanpa commit user yatim", async () => {
  let rolledBack = false;
  let identityValues;
  const db = { async apiTransaction(callback) {
    try {
      return await callback({ async query(sql, values) {
        if (sql.includes("from auth.users")) return { rows: [] };
        if (sql.includes("insert into auth.users")) return { rows: [{ id: "00000000-0000-4000-8000-000000000001", email: "contact@example.test" }] };
        if (sql.includes("insert into auth.identities")) identityValues = values;
        if (sql.includes("update utero_academy.school_contacts")) return { rowCount: 0 };
        return { rows: [], rowCount: 1 };
      } });
    } catch (error) {
      rolledBack = true;
      throw error;
    }
  } };
  const result = await inviteAccount(db, {}, null, { email: "contact@example.test", fullName: "Kontak Sekolah", role: "school", schoolId: "00000000-0000-4000-8000-000000000002" });
  assert.equal(result.status, 409);
  assert.equal(rolledBack, true);
  assert.deepEqual(identityValues?.slice(0, 2), ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000001"]);
  assert.equal(identityValues?.length, 3);
});

test("token undangan hanya dapat dipakai sekali", async () => {
  let consumed = false;
  const client = { async query(sql) {
    if (sql.includes("from auth.account_invitation_tokens")) return { rows: consumed ? [] : [{ user_id: "00000000-0000-4000-8000-000000000001" }] };
    if (sql.includes("set consumed_at")) consumed = true;
    return { rows: [], rowCount: 1 };
  } };
  const db = { async apiTransaction(callback) { return callback(client); }, async query() { return { rows: [] }; } };
  const app = Fastify();
  await app.register(authRoutes, { db, config: {} });
  const payload = { token: "a".repeat(64), password: "password-kuat-123" };
  assert.equal((await app.inject({ method: "POST", url: "/v1/auth/accept-invitation", payload })).statusCode, 200);
  assert.equal((await app.inject({ method: "POST", url: "/v1/auth/accept-invitation", payload })).statusCode, 400);
  await app.close();
});

test("reset password administratif menolak non-super-admin", async () => {
  const app = Fastify();
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => { request.identity = { id: "00000000-0000-4000-8000-000000000001", roles: ["admin"] }; });
  await app.register(superAdminRoutes, { db: {}, config: {} });
  const response = await app.inject({ method: "POST", url: "/v1/super-admin/users/00000000-0000-4000-8000-000000000002/reset-password", payload: { password: "password-kuat-123" } });
  assert.equal(response.statusCode, 403);
  await app.close();
});

test("reset password administratif mewajibkan aktivasi untuk akun impor pending", async () => {
  const app = Fastify();
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => { request.identity = { id: "00000000-0000-4000-8000-000000000001", roles: ["super_admin"] }; });
  const db = { async apiTransaction(callback) {
    return callback({ async query(sql) {
      if (sql.includes("select email_confirmed_at,encrypted_password")) {
        return { rows: [{ email_confirmed_at: null, encrypted_password: null }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    } });
  } };
  await app.register(superAdminRoutes, { db, config: {} });
  const response = await app.inject({ method: "POST", url: "/v1/super-admin/users/00000000-0000-4000-8000-000000000002/reset-password", payload: { password: "password-kuat-123" } });
  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), { error: "activation_required" });
  await app.close();
});
