import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { registrationRoutes } from "../src/routes/registration.mjs";

const userId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const programId = "33333333-3333-4333-8333-333333333333";
const body = {
  programId, fullName: "Budi Santoso", phone: "0812345678", schoolName: "SMK Utero",
  major: "RPL", motivation: "Saya ingin belajar pengembangan aplikasi.", studentNumber: "", referralCode: "",
  proposedStartDate: "2026-11-01", proposedEndDate: "2027-01-01",
  cvPath: `${userId}/applications/cv/44444444-4444-4444-8444-444444444444.pdf`, portfolioPath: null,
};

async function fixture(identity, query) {
  const app = Fastify();
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => { request.identity = identity; });
  await app.register(registrationRoutes, { db: { transaction: async (_identity, callback) => callback({ query }) } });
  return app;
}

test("registration menolak anonim, role lain, dan berkas milik pengguna lain", async () => {
  const query = () => { throw Error("Database tidak boleh disentuh"); };
  const anonymous = await fixture(null, query);
  assert.equal((await anonymous.inject({ method: "GET", url: "/v1/registration/dashboard" })).statusCode, 401);
  await anonymous.close();
  const school = await fixture({ id: userId, roles: ["school"] }, query);
  assert.equal((await school.inject({ method: "GET", url: "/v1/registration/selection" })).statusCode, 403);
  await school.close();
  const applicant = await fixture({ id: userId, email: "budi@example.com", roles: ["applicant"] }, query);
  assert.equal((await applicant.inject({ method: "POST", url: "/v1/registration/applications", payload: { ...body, cvPath: body.cvPath.replace(userId, otherId) } })).statusCode, 403);
  await applicant.close();
  const isolated = await fixture({ id: userId, email: "budi@example.com", roles: ["applicant"] }, async () => ({ rows: [], rowCount: 0 }));
  assert.equal((await isolated.inject({ method: "GET", url: `/v1/registration/selection/${programId}` })).statusCode, 404);
  await isolated.close();
});

test("registration tidak menyimpan pendaftaran bila berkas belum tercatat", async () => {
  const queries = [];
  const app = await fixture({ id: userId, email: "budi@example.com", roles: ["applicant"] }, async (sql) => {
    queries.push(sql);
    if (sql.includes("programs where")) return { rowCount: 1, rows: [{}] };
    return { rowCount: 0, rows: [] };
  });
  const result = await app.inject({ method: "POST", url: "/v1/registration/applications", payload: body });
  assert.equal(result.statusCode, 409);
  assert.equal(result.json().error, "documents_missing");
  assert.equal(queries.some((sql) => sql.includes("insert into utero_academy.internship_applications")), false);
  await app.close();
});

test("applicant selection read dan start selalu scoped ke pemilik aplikasi", async () => {
  const queries = [];
  const app = await fixture({ id: userId, roles: ["applicant"] }, async (sql, params) => {
    queries.push([sql, params]);
    if (/from utero_academy\.internship_applications where applicant_user_id/.test(sql)) return { rows: [], rowCount: 0 };
    if (/from utero_academy\.selection_assignments s/.test(sql)) return { rows: [{ id: programId, max_attempts: 1, duration_minutes: 30, is_published: true }], rowCount: 1 };
    if (/from utero_academy\.selection_attempts where assignment_id/.test(sql)) return { rows: [], rowCount: 0 };
    return { rows: [], rowCount: 0 };
  });
  assert.equal((await app.inject({ method: "GET", url: "/v1/registration/selection" })).statusCode, 200);
  assert.equal((await app.inject({ method: "POST", url: `/v1/registration/selection/${programId}/start` })).statusCode, 200);
  const scoped = queries.filter(([sql]) => /applicant_user_id/.test(sql));
  assert.ok(scoped.length >= 2);
  assert.ok(scoped.every(([, params]) => params.includes(userId)));
  await app.close();
});

test("answer save verifies active owned attempt, option, and attachment ownership", async () => {
  const queries = [];
  const attachmentPath = `${userId}/selection/${otherId}/${programId}/answer.pdf`;
  const app = await fixture({ id: userId, roles: ["applicant"] }, async (sql, params) => {
    queries.push([sql, params]);
    if (/from utero_academy\.selection_attempts t/.test(sql)) return { rows: [{ id: otherId, expires_at: new Date(Date.now() + 60_000).toISOString() }], rowCount: 1 };
    if (/select q\.question_type/.test(sql)) return { rows: [{ question_type: "file_upload" }], rowCount: 1 };
    if (/from academy_storage\.objects/.test(sql)) return { rows: [{ exists: true }], rowCount: 1 };
    if (/select attachment_path/.test(sql)) return { rows: [], rowCount: 0 };
    return { rows: [], rowCount: 1 };
  });
  const response = await app.inject({ method: "PUT", url: `/v1/registration/selection/${programId}/answers/${programId}`, payload: { optionId: null, answerText: "", attachmentPath } });
  assert.equal(response.statusCode, 200);
  const storageQuery = queries.find(([sql]) => /academy_storage\.objects/.test(sql));
  assert.deepEqual(storageQuery[1], [userId, attachmentPath]);
  assert.ok(queries.some(([sql, params]) => /insert into utero_academy\.selection_answers/.test(sql) && params[0] === otherId));
  await app.close();
});

test("selection submit computes objective score from stored answer key", async () => {
  const questionId = "44444444-4444-4444-8444-444444444444";
  const optionId = "55555555-5555-4555-8555-555555555555";
  const answerId = "66666666-6666-4666-8666-666666666666";
  const queries = [];
  const app = await fixture({ id: userId, roles: ["applicant"] }, async (sql, params) => {
    queries.push([sql, params]);
    if (/from utero_academy\.selection_attempts t/.test(sql)) return { rows: [{ id: otherId, expires_at: new Date(Date.now() + 60_000).toISOString() }], rowCount: 1 };
    if (/select q\.id, q\.question_type/.test(sql)) return { rows: [{ id: questionId, question_type: "multiple_choice", points: 20, is_required: true }], rowCount: 1 };
    if (/from utero_academy\.selection_answers where attempt_id/.test(sql)) return { rows: [{ id: answerId, question_id: questionId, selected_option_ids: [optionId], answer_text: null, attachment_path: null }], rowCount: 1 };
    if (/select is_correct/.test(sql)) return { rows: [{ is_correct: true }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });
  const response = await app.inject({ method: "POST", url: `/v1/registration/selection/${programId}/submit`, payload: { finalScore: 0, isCorrect: false } });
  assert.equal(response.statusCode, 200);
  const attemptUpdate = queries.find(([sql]) => /update utero_academy\.selection_attempts set status/.test(sql));
  assert.deepEqual(attemptUpdate[1], [otherId, "graded", 100]);
  assert.ok(queries.some(([sql, params]) => /selection_answers set auto_score/.test(sql) && params[1] === 20));
  await app.close();
});
