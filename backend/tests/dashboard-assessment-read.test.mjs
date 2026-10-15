import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { adminRoutes } from "../src/routes/admin.mjs";
import { assessmentsRoutes } from "../src/routes/assessments.mjs";

const userId = "11111111-1111-4111-8111-111111111111";
const internId = "22222222-2222-4222-8222-222222222222";

async function fixture(identity, query) {
  const app = Fastify();
  const actors = [];
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => { request.identity = identity; });
  const db = { transaction: async (actor, callback) => {
    actors.push(actor);
    return callback({ query });
  } };
  await app.register(adminRoutes, { db });
  await app.register(assessmentsRoutes, { db });
  return { app, actors };
}

test("dashboard admin dan assessment menolak anon dan role sekolah", async () => {
  for (const identity of [null, { id: userId, roles: ["school"], permissions: [] }]) {
    const { app, actors } = await fixture(identity, () => { throw Error("database tidak boleh disentuh"); });
    assert.equal((await app.inject("/v1/admin/dashboard")).statusCode, identity ? 403 : 401);
    assert.equal((await app.inject(`/v1/assessments/${internId}`)).statusCode, identity ? 403 : 401);
    assert.equal(actors.length, 0);
    await app.close();
  }
});

test("peserta hanya bisa melihat penilaian milik profil sendiri", async () => {
  const otherId = "33333333-3333-4333-8333-333333333333";
  const identity = { id: userId, roles: ["intern"], permissions: [] };
  const { app, actors } = await fixture(identity, async (sql) => {
    if (sql.includes("from utero_academy.intern_profiles")) return { rows: [{ id: internId }] };
    return { rows: [{ intern_id: internId, status: "draft" }] };
  });
  assert.equal((await app.inject(`/v1/assessments/${otherId}`)).statusCode, 403);
  const own = await app.inject(`/v1/assessments/${internId}`);
  assert.equal(own.statusCode, 200);
  assert.equal(own.json().assessment.intern_id, internId);
  assert.deepEqual(actors, [identity, identity]);
  await app.close();
});

test("dashboard metrics hanya berjalan dalam transaksi identitas", async () => {
  const identity = { id: userId, roles: ["admin"], permissions: ["interns.read"] };
  const { app, actors } = await fixture(identity, async (sql) => {
    if (sql.includes("total_interns")) return { rows: [{ total_interns: 4, total_schools: 2, total_tasks: 3, completed_tasks: 1 }] };
    if (sql.includes("attendance_type='present'")) return { rows: [{ total: 2, present: 1 }] };
    return { rows: [] };
  });
  const response = await app.inject("/v1/admin/dashboard");
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().metrics.attendanceRate, 50);
  assert.deepEqual(actors, [identity]);
  await app.close();
});
