import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { lmsRoutes } from "../src/routes/lms.mjs";

const userId = "11111111-1111-4111-8111-111111111111";
const resourceId = "22222222-2222-4222-8222-222222222222";
const attachmentId = "33333333-3333-4333-8333-333333333333";

async function fixture(identity, query) {
  const app = Fastify();
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => { request.identity = identity; });
  const db = { transaction: async (_actor, callback) => callback({ query }) };
  await app.register(lmsRoutes, { db });
  return app;
}

test("staff dapat menyimpan dan menghapus metadata attachment lesson", async () => {
  const queries = [];
  const attachment = { id: attachmentId, name: "materi.pdf", path: `lessons/${resourceId}/materi.pdf`, size: 123, type: "application/pdf" };
  const app = await fixture({ id: userId, roles: ["admin"], permissions: ["lms.manage"] }, async (sql, params) => {
    queries.push([sql, params]);
    if (/select attachments .* for update/.test(sql)) return { rows: [{ attachments: [attachment] }], rowCount: 1 };
    if (/update utero_academy\.lessons set attachments=coalesce/.test(sql)) return { rows: [{ course_id: resourceId }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });

  const created = await app.inject({ method: "POST", url: `/v1/lms/lessons/${resourceId}/attachments`, payload: attachment });
  assert.equal(created.statusCode, 201);
  const removed = await app.inject({ method: "DELETE", url: `/v1/lms/lessons/${resourceId}/attachments/${attachmentId}` });
  assert.equal(removed.statusCode, 200);
  assert.equal(removed.json().path, attachment.path);
  assert.ok(queries.some(([sql]) => /updated_at=now/.test(sql)));
  await app.close();
});

test("attachment lesson menolak path di luar lesson", async () => {
  let touched = false;
  const app = await fixture({ id: userId, roles: ["admin"], permissions: ["lms.manage"] }, async () => { touched = true; return { rows: [], rowCount: 0 }; });
  const response = await app.inject({ method: "POST", url: `/v1/lms/lessons/${resourceId}/attachments`, payload: {
    id: attachmentId, name: "materi.pdf", path: "lessons/other/materi.pdf", size: 123, type: "application/pdf",
  } });
  assert.equal(response.statusCode, 400);
  assert.equal(touched, false);
  await app.close();
});

test("enrollment hanya menerima intern profile milik identity", async () => {
  const app = await fixture({ id: userId, roles: ["intern"], permissions: ["lms.read"] }, async (sql) => {
    if (/select id from utero_academy\.intern_profiles/.test(sql)) return { rows: [{ id: resourceId }], rowCount: 1 };
    if (/course_enrollments/.test(sql)) return { rows: [{ exists: true }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
  assert.equal((await app.inject(`/v1/lms/courses/${resourceId}/enrollment?internId=${resourceId}`)).json().enrolled, true);
  assert.equal((await app.inject(`/v1/lms/courses/${resourceId}/enrollment?internId=${attachmentId}`)).statusCode, 404);
  await app.close();
});

test("quiz management dan certificate memakai transaksi backend terotorisasi", async () => {
  const staffQueries = [];
  const staffApp = await fixture({ id: userId, roles: ["admin"], permissions: ["lms.manage"] }, async (sql, params) => {
    staffQueries.push([sql, params]);
    return { rows: [{ id: resourceId, course_id: resourceId }], rowCount: 1 };
  });
  const created = await staffApp.inject({ method: "POST", url: `/v1/lms/courses/${resourceId}/quizzes`, payload: { title: "Kuis", questions: [{ prompt: "Q" }], passingScore: 80, timeLimitMinutes: 30 } });
  assert.equal(created.statusCode, 201);
  assert.equal((await staffApp.inject({ method: "PATCH", url: `/v1/lms/quizzes/${resourceId}/publish`, payload: { isPublished: true } })).statusCode, 200);
  assert.ok(staffQueries.some(([sql]) => /insert into utero_academy\.quizzes/.test(sql)));
  await staffApp.close();

  const internApp = await fixture({ id: userId, roles: ["intern"], permissions: ["lms.read"] }, async (sql) => {
    if (/select id from utero_academy\.intern_profiles/.test(sql)) return { rows: [{ id: resourceId }], rowCount: 1 };
    if (/select completed_at from utero_academy\.course_enrollments/.test(sql)) return { rows: [{ completed_at: new Date().toISOString() }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });
  assert.equal((await internApp.inject({ method: "POST", url: `/v1/lms/courses/${resourceId}/certificate`, payload: { internId: resourceId } })).statusCode, 201);
  await internApp.close();
});
