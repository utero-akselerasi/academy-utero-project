import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { lmsRoutes } from "../src/routes/lms.mjs";

const userId = "11111111-1111-4111-8111-111111111111";
const resourceId = "22222222-2222-4222-8222-222222222222";
const internPermissions = ["lms.read", "tasks.read", "tasks.submit", "attendance.submit", "daily_reports.submit", "certificates.read"];

async function fixture(identity, query = async () => ({ rows: [], rowCount: 0 })) {
  const app = Fastify();
  const transactions = [];
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => { request.identity = identity; });
  const db = { transaction: async (actor, callback) => { transactions.push(actor); return callback({ query }); } };
  await app.register(lmsRoutes, { db });
  return { app, transactions };
}

test("LMS write routes reject users without required role and permission", async () => {
  const identity = { id: userId, roles: ["applicant"], permissions: [] };
  const { app, transactions } = await fixture(identity, () => { throw new Error("database must not be touched"); });
  assert.equal((await app.inject({ method: "POST", url: `/v1/lms/courses/${resourceId}/assignments`, payload: { title: "Tugas" } })).statusCode, 403);
  assert.equal((await app.inject({ method: "PATCH", url: `/v1/lms/submissions/${resourceId}/grade`, payload: { score: 90 } })).statusCode, 403);
  assert.equal(transactions.length, 0);
  await app.close();
});

test("assignment submission derives intern and course access inside identity transaction", async () => {
  const identity = { id: userId, roles: ["intern"], permissions: internPermissions };
  const queries = [];
  const { app, transactions } = await fixture(identity, async (sql, params) => {
    queries.push([sql, params]);
    if (/select a\.\*,ip\.id as intern_id/.test(sql)) return { rows: [{ id: resourceId, intern_id: resourceId, course_id: resourceId }], rowCount: 1 };
    if (/select id from utero_academy\.assignment_submissions/.test(sql)) return { rows: [], rowCount: 0 };
    if (/insert into utero_academy\.assignment_submissions/.test(sql)) return { rows: [{ id: resourceId }], rowCount: 1 };
    return { rows: [{ id: resourceId }], rowCount: 1 };
  });
  const response = await app.inject({ method: "POST", url: `/v1/lms/assignments/${resourceId}/submission`, payload: { content: "Jawaban" } });
  assert.equal(response.statusCode, 201);
  assert.deepEqual(transactions, [identity]);
  assert.match(queries[0][0], /course_enrollments/);
  assert.ok(queries.some(([sql]) => /check_and_award_badges/.test(sql)));
  await app.close();
});

test("grading query keeps mentor scope in SQL and ignores client intern IDs", async () => {
  const identity = { id: userId, roles: ["admin"], permissions: ["lms.manage"] };
  const queries = [];
  const { app } = await fixture(identity, async (sql, params) => {
    queries.push([sql, params]);
    if (/update utero_academy\.assignment_submissions/.test(sql)) return { rows: [{ intern_id: resourceId }], rowCount: 1 };
    if (/select user_id from utero_academy\.intern_profiles/.test(sql)) return { rows: [{ user_id: resourceId }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
  const response = await app.inject({ method: "PATCH", url: `/v1/lms/submissions/${resourceId}/grade`, payload: { score: 88, internId: userId } });
  assert.equal(response.statusCode, 200);
  assert.match(queries[0][0], /mentor_assignments/);
  assert.equal(queries[0][1].includes(userId), true);
  await app.close();
});

test("achievement endpoint blocks cross-user access for intern", async () => {
  const identity = { id: userId, roles: ["intern"], permissions: internPermissions };
  const { app, transactions } = await fixture(identity);
  assert.equal((await app.inject({ method: "GET", url: `/v1/lms/users/${resourceId}/achievements` })).statusCode, 403);
  assert.equal(transactions.length, 0);
  await app.close();
});

test("intern seed permissions authorize enrollment, detail, and lesson progress", async () => {
  const identity = { id: userId, roles: ["intern"], permissions: internPermissions };
  const queries = [];
  const { app } = await fixture(identity, async (sql, params) => {
    queries.push([sql, params]);
    if (/select id from utero_academy\.intern_profiles/.test(sql)) return { rows: [{ id: resourceId }], rowCount: 1 };
    if (/select id from utero_academy\.courses where id=.*status='published'/.test(sql)) return { rows: [{ id: resourceId }], rowCount: 1 };
    if (/select 1 from utero_academy\.course_enrollments/.test(sql)) return { rows: [{ exists: true }], rowCount: 1 };
    if (/select id,title,description,slug,status from utero_academy\.courses/.test(sql)) return { rows: [{ id: resourceId, title: "Course" }], rowCount: 1 };
    if (/select l\.id, l\.course_id, ip\.id as intern_id/.test(sql)) return { rows: [{ id: resourceId, course_id: resourceId, intern_id: resourceId }], rowCount: 1 };
    if (/select 1 from utero_academy\.lessons l where l\.course_id/.test(sql)) return { rows: [], rowCount: 0 };
    return { rows: [], rowCount: 0 };
  });

  assert.equal((await app.inject({ method: "POST", url: `/v1/lms/courses/${resourceId}/enroll` })).statusCode, 201);
  assert.equal((await app.inject({ method: "GET", url: `/v1/lms/courses/${resourceId}/detail` })).statusCode, 200);
  assert.equal((await app.inject({ method: "POST", url: `/v1/lms/lessons/${resourceId}/progress` })).statusCode, 200);
  assert.ok(queries.some(([sql]) => /insert into utero_academy\.certificates/.test(sql)));
  assert.ok(queries.some(([sql]) => /on conflict \(intern_id,course_id\) where course_id is not null do nothing/.test(sql)));
  await app.close();
});
