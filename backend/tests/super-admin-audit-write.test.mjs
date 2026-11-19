import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { superAdminRoutes } from "../src/routes/super-admin.mjs";

const identity = { id: "10000000-0000-4000-8000-000000000001", roles: ["admin"], permissions: [] };

test("audit write memakai actor dari sesi dan bukan payload", async () => {
  const calls = [];
  const db = { transaction: async (actor, callback) => {
    assert.equal(actor, identity);
    return callback({ query: async (sql, values) => { calls.push({ sql, values }); return { rows: [], rowCount: 1 }; } });
  } };
  const app = Fastify();
  app.addHook("preHandler", async (request) => { request.identity = identity; });
  await app.register(superAdminRoutes, { db, config: {} });
  const response = await app.inject({ method: "POST", url: "/v1/super-admin/audit-logs", payload: {
    actorId: "20000000-0000-4000-8000-000000000002",
    action: "attendance.export",
    resourceType: "attendances",
    metadata: { rows: 3 },
  } });
  assert.equal(response.statusCode, 204);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].values[0], "attendance.export");
  assert.equal(calls[0].values[1], "attendances");
  assert.equal(calls[0].values[5], JSON.stringify({ rows: 3 }));
});

test("audit write menolak resource id invalid", async () => {
  const db = { transaction: async () => { throw new Error("should not mutate"); } };
  const app = Fastify();
  app.addHook("preHandler", async (request) => { request.identity = identity; });
  await app.register(superAdminRoutes, { db, config: {} });
  const response = await app.inject({ method: "POST", url: "/v1/super-admin/audit-logs", payload: {
    action: "update",
    resourceType: "schools",
    resourceId: "invalid",
  } });
  assert.equal(response.statusCode, 400);
});
