import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { superAdminRoutes } from "../src/routes/super-admin.mjs";

const actorId = "00000000-0000-4000-8000-000000000001";
const targetId = "00000000-0000-4000-8000-000000000002";

async function build(identity, db) {
  const app = Fastify();
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => { request.identity = identity; });
  await app.register(superAdminRoutes, { db, config: {} });
  return app;
}

test("mutasi super-admin menolak role lain sebelum membuka transaksi", async () => {
  let called = false;
  const db = {
    async transaction() { called = true; },
    async apiTransaction() { called = true; },
  };
  const app = await build({ id: actorId, roles: ["admin"] }, db);
  const response = await app.inject({ method: "POST", url: "/v1/super-admin/schools", payload: { name: "Sekolah Uji" } });
  assert.equal(response.statusCode, 403);
  assert.equal(called, false);
  await app.close();
});

test("create school memakai transaksi RLS super-admin dan audit", async () => {
  const queries = [];
  let transactionIdentity;
  const identity = { id: actorId, userId: actorId, roles: ["super_admin"] };
  const db = { async transaction(received, callback) {
    transactionIdentity = received;
    return callback({ async query(sql, values) {
      queries.push({ sql, values });
      if (sql.includes("insert into utero_academy.schools")) return { rows: [{ id: targetId }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    } });
  } };
  const app = await build(identity, db);
  const response = await app.inject({ method: "POST", url: "/v1/super-admin/schools", payload: { name: "  Sekolah   Uji  ", city: "Bandung" } });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().id, targetId);
  assert.equal(transactionIdentity, identity);
  assert.equal(queries.find(({ sql }) => sql.includes("insert into utero_academy.schools")).values[0], "Sekolah Uji");
  assert.ok(queries.some(({ sql, values }) => sql.includes("append_audit_log") && values[0] === "create_school"));
  await app.close();
});

test("create user memisahkan parameter text dan uuid untuk auth identity", async () => {
  let identityValues;
  const db = { async apiTransaction(callback) {
    return callback({ async query(sql, values) {
      if (sql.includes("from utero_academy.roles")) return { rows: [{ id: targetId, code: "school" }], rowCount: 1 };
      if (sql.includes("select 1 from auth.users")) return { rows: [], rowCount: 0 };
      if (sql.includes("insert into auth.users")) return { rows: [{ id: targetId }], rowCount: 1 };
      if (sql.includes("insert into auth.identities")) identityValues = values;
      return { rows: [], rowCount: 1 };
    } });
  } };
  const app = await build({ id: actorId, roles: ["super_admin"] }, db);
  const response = await app.inject({ method: "POST", url: "/v1/super-admin/users", payload: {
    fullName: "School Smoke", email: "school-smoke@example.test", password: "password-kuat-123", roleId: targetId,
  } });
  assert.equal(response.statusCode, 201);
  assert.deepEqual(identityValues?.slice(0, 2), [targetId, targetId]);
  assert.equal(identityValues?.length, 3);
  await app.close();
});

test("link school contact memakai transaksi RLS super-admin", async () => {
  const identity = { id: actorId, userId: actorId, roles: ["super_admin"] };
  let transactionIdentity;
  const db = { async transaction(received, callback) {
    transactionIdentity = received;
    return callback({ async query(sql) {
      if (sql.includes("from utero_academy.user_profiles")) return { rows: [{ full_name: "School User", phone: null, email: "school@example.test" }], rowCount: 1 };
      if (sql.includes("select 1 from utero_academy.schools")) return { rows: [{}], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    } });
  } };
  const app = await build(identity, db);
  const response = await app.inject({ method: "PUT", url: "/v1/super-admin/users/" + targetId + "/school-contact", payload: { schoolId: actorId, position: "PIC" } });
  assert.equal(response.statusCode, 200);
  assert.equal(transactionIdentity, identity);
  await app.close();
});

test("update periode memakai transaksi RLS caller dan mengaudit perubahan", async () => {
  const identity = { id: actorId, userId: actorId, roles: ["super_admin"] };
  const queries = [];
  let transactionIdentity;
  const db = { async transaction(received, callback) {
    transactionIdentity = received;
    return callback({ async query(sql, values) {
      queries.push({ sql, values });
      if (sql.includes("from utero_academy.intern_profiles") && sql.includes("for update")) return { rows: [{ status: "pending" }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    } });
  } };
  const app = await build(identity, db);
  const response = await app.inject({ method: "PATCH", url: `/v1/super-admin/interns/${targetId}/period`, payload: {
    startDate: "2026-10-01", endDate: "2026-12-01", major: "RPL", gradeOrSemester: "12", status: "active",
  } });
  assert.equal(response.statusCode, 200);
  assert.equal(transactionIdentity, identity);
  assert.ok(queries.some(({ sql }) => sql.startsWith("update utero_academy.intern_profiles")));
  assert.ok(queries.some(({ sql, values }) => sql.includes("append_audit_log") && values[0] === "update_intern_period"));
  await app.close();
});

test("update periode menolak tanggal terbalik sebelum transaksi", async () => {
  let called = false;
  const app = await build({ id: actorId, roles: ["super_admin"] }, { async transaction() { called = true; } });
  const response = await app.inject({ method: "PATCH", url: `/v1/super-admin/interns/${targetId}/period`, payload: {
    startDate: "2026-12-01", endDate: "2026-10-01", status: "active",
  } });
  assert.equal(response.statusCode, 400);
  assert.equal(called, false);
  await app.close();
});

test("delete user menolak akun sendiri tanpa query database", async () => {
  let called = false;
  const app = await build({ id: actorId, roles: ["super_admin"] }, { async apiTransaction() { called = true; } });
  const response = await app.inject({ method: "DELETE", url: `/v1/super-admin/users/${actorId}` });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error, "cannot_delete_self");
  assert.equal(called, false);
  await app.close();
});

test("delete user memakai fungsi terverifikasi tanpa grant DELETE auth.users", async () => {
  const queries = [];
  const db = { async apiTransaction(callback) {
    return callback({ async query(sql) {
      queries.push(sql);
      if (sql.includes("delete_auth_user")) return { rows: [{ id: targetId, email: "user@example.test" }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    } });
  } };
  const app = await build({ id: actorId, roles: ["super_admin"] }, db);
  const response = await app.inject({ method: "DELETE", url: "/v1/super-admin/users/" + targetId });
  assert.equal(response.statusCode, 200);
  assert.ok(queries.some((sql) => sql.includes("delete_auth_user")));
  assert.ok(!queries.some((sql) => sql.startsWith("delete from auth.users")));
  await app.close();
});

test("delete school berhenti saat relasi masih ada dan tidak menulis audit sukses", async () => {
  const queries = [];
  const db = { async transaction(_identity, callback) {
    return callback({ async query(sql, values) {
      queries.push({ sql, values });
      if (sql.includes("from utero_academy.schools") && sql.includes("for update")) return { rows: [{ id: targetId }], rowCount: 1 };
      if (sql.startsWith("select exists")) return { rows: [{ linked: true }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    } });
  } };
  const app = await build({ id: actorId, roles: ["super_admin"] }, db);
  const response = await app.inject({ method: "DELETE", url: `/v1/super-admin/schools/${targetId}` });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error, "school_in_use");
  assert.equal(queries.some(({ sql }) => sql.includes("append_audit_log")), false);
  await app.close();
});
