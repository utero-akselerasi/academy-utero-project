import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { adminRoutes } from "../src/routes/admin.mjs";
import { selectionStaffRoutes } from "../src/routes/selection-staff.mjs";

const uuid = "11111111-1111-4111-8111-111111111111";

async function fixture(identity, query = async () => ({ rows: [], rowCount: 0 })) {
  const app = Fastify();
  const transactions = [];
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => { request.identity = identity; });
  const db = { transaction: async (actor, callback) => { transactions.push(actor); return callback({ query }); } };
  await app.register(adminRoutes, { db });
  await app.register(selectionStaffRoutes, { db });
  return { app, transactions };
}

test("anonymous and applicant cannot access staff data or mutate workflow", async () => {
  for (const identity of [null, { id: uuid, roles: ["applicant"], permissions: [] }]) {
    const { app, transactions } = await fixture(identity, () => { throw Error("database must not be touched"); });
    for (const [method, url, payload] of [
      ["GET", "/v1/admin/applications"],
      ["GET", "/v1/selection/staff/workspace"],
      ["POST", "/v1/selection/staff/bypass", { applicationId: uuid, reason: "Contoh alasan bypass seleksi" }],
      ["POST", "/v1/admin/placements", { internId: uuid, mentorId: uuid }],
    ]) assert.equal((await app.inject({ method, url, payload })).statusCode, identity ? 403 : 401);
    assert.equal(transactions.length, 0);
    await app.close();
  }
});

test("permission split enforces read, review, placement and super-admin bypass", async () => {
  const identity = { id: uuid, roles: ["admin"], permissions: ["applications.read", "interns.read"] };
  const { app, transactions } = await fixture(identity);
  assert.equal((await app.inject({ method: "GET", url: "/v1/admin/applications" })).statusCode, 200);
  assert.equal((await app.inject({ method: "POST", url: "/v1/selection/staff/tracks", payload: { name: "Jalur", code: "JALUR" } })).statusCode, 403);
  assert.equal((await app.inject({ method: "PATCH", url: `/v1/admin/applications/${uuid}/status`, payload: { status: "reviewed" } })).statusCode, 403);
  assert.equal((await app.inject({ method: "POST", url: "/v1/selection/staff/bypass", payload: { applicationId: uuid, reason: "Contoh alasan bypass seleksi" } })).statusCode, 403);
  assert.deepEqual(transactions, [identity]);
  await app.close();
});

test("staff review calls acceptance function inside identity-scoped transaction", async () => {
  const identity = { id: uuid, roles: ["admin"], permissions: ["applications.review"] };
  const queries = [];
  const { app, transactions } = await fixture(identity, async (sql, params) => { queries.push([sql, params]); return { rows: [{ id: uuid }], rowCount: 1 }; });
  const response = await app.inject({ method: "PATCH", url: `/v1/admin/applications/${uuid}/status`, payload: { status: "accepted", startDate: "2026-11-01", endDate: "2027-01-01" } });
  assert.equal(response.statusCode, 200);
  assert.match(queries[0][0], /accept_application_as_intern/);
  assert.deepEqual(queries[0][1], [uuid, "2026-11-01", "2027-01-01"]);
  assert.deepEqual(transactions, [identity]);
  assert.equal((await app.inject({ method: "PATCH", url: `/v1/admin/applications/${uuid}/status`, payload: { status: "accepted", startDate: "2027-01-01", endDate: "2026-11-01" } })).statusCode, 400);
  await app.close();
});
