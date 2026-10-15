import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { tasksRoutes } from "../routes/tasks.mjs";
import { lmsRoutes } from "../routes/lms.mjs";

const internId = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";

async function fixture(identity) {
  const app = Fastify();
  const queries = [];
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => { request.identity = identity; });
  const db = {
    async transaction(_identity, callback) {
      return callback({ async query(sql, values) {
        queries.push({ sql, values });
        if (sql.includes("from utero_academy.intern_profiles")) return { rows: [{ id: internId }] };
        if (sql.includes("from utero_academy.task_cards")) return { rows: [{ id: otherId, intern_id: internId }] };
        if (sql.includes("from utero_academy.courses where id=")) return { rows: [{ id: internId }], rowCount: 1 };
        return { rows: [] };
      } });
    },
  };
  await app.register(tasksRoutes, { db });
  await app.register(lmsRoutes, { db });
  return { app, queries };
}

test("guest cannot read tasks or LMS", async () => {
  const { app, queries } = await fixture(null);
  for (const url of ["/v1/tasks/boards", "/v1/tasks/cards", "/v1/lms/courses/published", "/v1/lms/enrollments"]) {
    assert.equal((await app.inject({ url })).statusCode, 401);
  }
  assert.equal(queries.length, 0);
  await app.close();
});

test("intern cannot read staff boards or draft courses", async () => {
  const { app, queries } = await fixture({ id: otherId, roles: ["intern"], permissions: ["tasks.submit", "lms.view"] });
  assert.equal((await app.inject({ url: "/v1/tasks/boards" })).statusCode, 403);
  assert.equal((await app.inject({ url: "/v1/lms/courses" })).statusCode, 403);
  assert.equal((await app.inject({ url: "/v1/tasks/cards?internId=" + otherId })).statusCode, 404);
  assert.equal((await app.inject({ url: "/v1/lms/courses/published" })).statusCode, 200);
  assert.match(queries.at(-1).sql, /status = 'published'/);
  await app.close();
});

test("board id rejected before database access", async () => {
  const { app, queries } = await fixture({ id: otherId, roles: ["admin"], permissions: ["tasks.manage", "lms.manage"] });
  assert.equal((await app.inject({ url: "/v1/tasks/boards/bad-id" })).statusCode, 400);
  assert.equal(queries.length, 0);
  await app.close();
});

test("write routes reject guests and unauthorized roles before database access", async () => {
  const { app, queries } = await fixture(null);
  for (const [method, url] of [["POST", "/v1/tasks/boards"], ["POST", "/v1/tasks/cards"], ["POST", `/v1/tasks/cards/${internId}/attachments`], ["POST", "/v1/lms/courses"], ["POST", `/v1/lms/courses/${internId}/enroll`]]) {
    assert.equal((await app.inject({ method, url, payload: {} })).statusCode, 401);
  }
  assert.equal(queries.length, 0);
  await app.close();
});

test("intern cannot create boards, cards or lessons", async () => {
  const { app, queries } = await fixture({ id: otherId, roles: ["intern"], permissions: ["tasks.submit", "lms.view"] });
  for (const [method, url] of [["POST", "/v1/tasks/boards"], ["POST", "/v1/tasks/cards"], ["POST", `/v1/lms/courses/${internId}/lessons`]]) {
    assert.equal((await app.inject({ method, url, payload: {} })).statusCode, 403);
  }
  assert.equal(queries.length, 0);
  await app.close();
});

test("staff write input rejects invalid IDs before database access", async () => {
  const { app, queries } = await fixture({ id: otherId, roles: ["admin"], permissions: ["tasks.manage", "lms.manage"] });
  assert.equal((await app.inject({ method: "POST", url: "/v1/tasks/cards", payload: { listId: "bad", title: "Task" } })).statusCode, 400);
  assert.equal((await app.inject({ method: "PATCH", url: `/v1/tasks/cards/${internId}`, payload: { priority: "invalid" } })).statusCode, 400);
  assert.equal((await app.inject({ method: "POST", url: "/v1/lms/courses", payload: { title: "---" } })).statusCode, 400);
  assert.equal(queries.length, 0);
  await app.close();
});

test("lesson content memakai kolom text, bukan jsonb", async () => {
  const { app, queries } = await fixture({ id: otherId, roles: ["super_admin"], permissions: ["lms.manage"] });
  await app.inject({ method: "POST", url: `/v1/lms/courses/${internId}/lessons`, payload: { title: "Materi", content: "<p>Isi</p>" } });
  const insert = queries.find(({ sql }) => sql.includes("insert into utero_academy.lessons"));
  assert.match(insert.sql, /\$3::text/);
  assert.equal(insert.values[2], "<p>Isi</p>");

  await app.inject({ method: "PATCH", url: `/v1/lms/lessons/${internId}`, payload: { content: "<p>Baru</p>" } });
  const update = queries.find(({ sql }) => sql.includes("update utero_academy.lessons"));
  assert.match(update.sql, /\$4::text/);
  assert.equal(update.values[3], "<p>Baru</p>");
  await app.close();
});
