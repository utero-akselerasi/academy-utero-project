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
  const response = await app.inject({ method: "PATCH", url: "/v1/admin/applications/" + uuid + "/status", payload: { status: "accepted", startDate: "2026-11-01", endDate: "2027-01-01" } });
  assert.equal(response.statusCode, 200);
  assert.match(queries[0][0], /accept_application_as_intern/);
  assert.deepEqual(queries[0][1], [uuid, "2026-11-01", "2027-01-01"]);
  assert.deepEqual(transactions, [identity]);
  assert.equal((await app.inject({ method: "PATCH", url: "/v1/admin/applications/" + uuid + "/status", payload: { status: "accepted", startDate: "2027-01-01", endDate: "2026-11-01" } })).statusCode, 400);
  await app.close();
});

test("acceptance maps only the selection precondition error to conflict", async () => {
  const identity = { id: uuid, roles: ["admin"], permissions: ["applications.review"] };
  const payload = { status: "accepted", startDate: "2026-11-01", endDate: "2027-01-01" };
  for (const [error, expectedStatus] of [
    [Object.assign(new Error("Peserta belum dinyatakan lolos seleksi"), { code: "P0001" }), 409],
    [Object.assign(new Error("Other failure"), { code: "P0001" }), 500],
  ]) {
    const { app } = await fixture(identity, async () => { throw error; });
    const response = await app.inject({ method: "PATCH", url: "/v1/admin/applications/" + uuid + "/status", payload });
    assert.equal(response.statusCode, expectedStatus);
    if (expectedStatus === 409) assert.deepEqual(response.json(), { error: "selection_not_passed" });
    await app.close();
  }
});

test("draft test edits update only unpublished package fields", async () => {
  const identity = { id: uuid, roles: ["admin"], permissions: ["applications.review"] };
  const queries = [];
  const { app } = await fixture(identity, async (sql, params) => {
    queries.push([sql, params]);
    return { rows: [{ id: uuid }], rowCount: 1 };
  });
  const response = await app.inject({
    method: "PUT", url: "/v1/selection/staff/tests/" + uuid,
    payload: { trackId: uuid, code: "FUNDAMENTAL_IT", title: "Tes Fundamental", description: "Petunjuk", passingScore: 70, durationMinutes: 60, maxAttempts: 1 },
  });
  assert.equal(response.statusCode, 200);
  assert.match(queries[0][0], /where id=\$1 and not is_published returning id/);
  assert.equal(queries[1][1][0], "update_selection_test");
  await app.close();
});

test("published test rejects question edits without changing questions", async () => {
  const identity = { id: uuid, roles: ["admin"], permissions: ["applications.review"] };
  const queries = [];
  const { app } = await fixture(identity, async (sql) => {
    queries.push(sql);
    if (sql.includes("select is_published")) return { rows: [{ is_published: true }], rowCount: 1 };
    throw Error("published package must not be modified");
  });
  const response = await app.inject({
    method: "PUT", url: "/v1/selection/staff/tests/" + uuid + "/questions/" + uuid,
    payload: { type: "multiple_choice", prompt: "Pertanyaan", points: 10, orderIndex: 0, expectedAnswer: "", options: ["A", "B"], correctOption: "A" },
  });
  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), { error: "test_locked" });
  assert.equal(queries.length, 1);
  await app.close();
});


test("duplicate assignment returns readable state without inserting another", async () => {
  const identity = { id: uuid, roles: ["admin"], permissions: ["applications.review"] };
  const queries = [];
  const { app } = await fixture(identity, async (sql, params) => {
    queries.push([sql, params]);
    if (sql.includes("select track_id, is_published, is_active")) return { rows: [{ track_id: uuid, is_published: true, is_active: true }], rowCount: 1 };
    if (sql.includes("select selection_track_id")) return { rows: [{ selection_track_id: uuid }], rowCount: 1 };
    if (sql.includes("select s.id, s.status, t.status attempt_status")) return { rows: [{ id: uuid, status: "in_progress", attempt_status: "in_progress", expires_at: new Date(Date.now() + 60000) }], rowCount: 1 };
    throw Error("duplicate assignment must not write");
  });
  const payload = { applicationId: uuid, testId: uuid };
  const response = await app.inject({ method: "POST", url: "/v1/selection/staff/assignments", payload });
  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), { error: "already_assigned", assignmentId: uuid, state: "in_progress" });
  assert.equal(queries.length, 3);
  assert.match(queries[2][0], /previous\.code=/);
  await app.close();
});

test("expired empty attempt may be reassigned with reason and keeps prior row", async () => {
  const identity = { id: uuid, roles: ["admin"], permissions: ["applications.review"] };
  const queries = [];
  const { app } = await fixture(identity, async (sql, params) => {
    queries.push([sql, params]);
    if (sql.includes("select track_id, is_published, is_active")) return { rows: [{ track_id: uuid, is_published: true, is_active: true }], rowCount: 1 };
    if (sql.includes("select selection_track_id")) return { rows: [{ selection_track_id: uuid }], rowCount: 1 };
    if (sql.includes("select s.id, s.status, t.status attempt_status")) return { rows: [{ id: uuid, status: "in_progress", attempt_status: "in_progress", expires_at: new Date(Date.now() - 60000) }], rowCount: 1 };
    if (sql.includes("select 1 from utero_academy.selection_answers")) return { rows: [], rowCount: 0 };
    if (sql.includes("assign_selection_test")) return { rows: [{ id: uuid }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });
  const response = await app.inject({ method: "POST", url: "/v1/selection/staff/assignments", payload: { applicationId: uuid, testId: uuid, retry: true, reason: "Tes tidak sengaja dimulai" } });
  assert.equal(response.statusCode, 201);
  assert.ok(queries.some(([sql]) => sql.includes("set status='expired'")));
  assert.ok(queries.some(([sql, params]) => sql.includes("append_audit_log") && params[0] === "retry_selection_test"));
  assert.ok(!queries.some(([sql]) => /^delete /i.test(sql)));
  await app.close();
});

test("package correction rejects started tests before touching package", async () => {
  const identity = { id: uuid, roles: ["admin"], permissions: ["applications.review"] };
  const { app } = await fixture(identity, async (sql) => {
    if (sql.includes("select id,application_id,package_id")) return { rows: [{ id: uuid, application_id: uuid, package_id: uuid }], rowCount: 1 };
    if (sql.includes("from utero_academy.selection_attempts")) return { rows: [{ id: uuid }], rowCount: 1 };
    throw Error("started package must not change");
  });
  const response = await app.inject({ method: "PUT", url: "/v1/selection/staff/assignments/" + uuid + "/package", payload: { testId: uuid, reason: "Paket tes diberikan keliru" } });
  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), { error: "correction_started" });
  await app.close();
});


test("publishing revision keeps older published package accessible but inactive", async () => {
  const identity = { id: uuid, roles: ["admin"], permissions: ["applications.review"] };
  const queries = [];
  const { app } = await fixture(identity, async (sql, params) => {
    queries.push([sql, params]);
    if (sql.includes("select count(*)")) return { rows: [{ count: 5 }], rowCount: 1 };
    if (sql.includes("select id,code,track_id")) return { rows: [{ id: uuid, code: "FUNDAMENTAL_IT", track_id: uuid }], rowCount: 1 };
    return { rows: [{ id: uuid }], rowCount: 1 };
  });
  const response = await app.inject({ method: "POST", url: "/v1/selection/staff/tests/" + uuid + "/publish" });
  assert.equal(response.statusCode, 200);
  assert.ok(queries.findIndex(([sql]) => sql.includes("set is_active=false")) < queries.findIndex(([sql]) => sql.includes("set is_published=true,is_active=true")));
  assert.ok(queries.some(([sql, params]) => sql.includes("set is_active=false") && params[0] === "FUNDAMENTAL_IT"));
  assert.ok(!queries.some(([sql]) => /^delete /i.test(sql)));
  await app.close();
});
