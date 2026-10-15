import test from "node:test";
import assert from "node:assert/strict";
import { assignRole, removeRole } from "./roles.mjs";
import { superAdminRoutes } from "../routes/super-admin.mjs";

const identity = { id: "10000000-0000-4000-8000-000000000001", roles: ["super_admin"] };
const userId = "20000000-0000-4000-8000-000000000002";
const roleId = "30000000-0000-4000-8000-000000000003";

test("legacy role ditolak sebelum insert", async () => {
  const queries = [];
  const db = { transaction: async (_identity, callback) => callback({ query: async (sql) => {
    queries.push(sql);
    return { rows: sql.includes("from utero_academy.roles") ? [{ id: roleId, code: "mentor" }] : [] };
  } }) };
  assert.deepEqual(await assignRole(db, identity, userId, roleId), { status: 400, error: "invalid_role" });
  assert.equal(queries.some((sql) => sql.includes("insert into utero_academy.user_roles")), false);
});

test("assign idempoten tidak membuat audit duplikat", async () => {
  const queries = [];
  const db = { transaction: async (_identity, callback) => callback({ query: async (sql) => {
    queries.push(sql);
    if (sql.includes("from utero_academy.roles")) return { rows: [{ id: roleId, code: "school" }] };
    if (sql.includes("from auth.users")) return { rows: [{ id: userId }] };
    return { rows: [] };
  } }) };
  assert.deepEqual(await assignRole(db, identity, userId, roleId), { status: 200, unchanged: true });
  assert.equal(queries.some((sql) => sql.includes("insert into utero_academy.audit_logs")), false);
});

test("assign baru menulis role dan audit dalam transaksi sama", async () => {
  const queries = [];
  const db = { transaction: async (_identity, callback) => callback({ query: async (sql) => {
    queries.push(sql);
    if (sql.includes("from utero_academy.roles")) return { rows: [{ id: roleId, code: "school" }] };
    if (sql.includes("from auth.users")) return { rows: [{ id: userId }] };
    if (sql.includes("insert into utero_academy.user_roles")) return { rows: [{ id: roleId }] };
    return { rows: [] };
  } }) };
  assert.equal((await assignRole(db, identity, userId, roleId)).status, 201);
  assert.equal(queries.filter((sql) => sql.includes("append_audit_log")).length, 1);
});

test("hapus role super_admin sendiri ditolak tanpa mutasi", async () => {
  const queries = [];
  const db = { transaction: async (_identity, callback) => callback({ query: async (sql) => {
    queries.push(sql);
    return { rows: sql.includes("from utero_academy.user_roles ur") ? [{ id: roleId, user_id: identity.id, code: "super_admin" }] : [] };
  } }) };
  assert.equal((await removeRole(db, identity, roleId)).status, 409);
  assert.equal(queries.some((sql) => sql.startsWith("delete from")), false);
});

test("route role menolak sesi tanpa super_admin", async () => {
  const handlers = new Map();
  await superAdminRoutes({ get: (path, handler) => handlers.set(path, handler), post: (path, handler) => handlers.set(path, handler), delete: (path, handler) => handlers.set(path, handler) }, { db: { query() { throw new Error("should not query"); } } });
  const reply = { code(status) { this.status = status; return this; }, send(body) { this.body = body; return this; } };
  await handlers.get("/v1/super-admin/users")({ identity: { roles: ["admin"] } }, reply);
  assert.equal(reply.status, 403);
  assert.equal(reply.body.error, "forbidden");
});
