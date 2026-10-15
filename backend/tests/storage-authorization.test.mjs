import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { storageRoutes } from "../src/routes/storage.mjs";

const identity = { id: "11111111-1111-4111-8111-111111111111", roles: ["intern"], permissions: ["lms.read", "tasks.submit"] };

async function build(query) {
  const app = Fastify();
  const db = { query, transaction(_identity, callback) { return callback({ query }); } };
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => { request.identity = identity; });
  await app.register(storageRoutes, { db, config: { storageRoot: "/srv/storage", storageSigningSecret: "x".repeat(32) } });
  return app;
}

test("intern dapat menandatangani lampiran learning dari course yang diikuti", async () => {
  const app = await build(async (sql) => ({ rows: sql.includes("can_read_shared_attachment") ? [{ allowed: true }] : [] }));
  const response = await app.inject({ method: "POST", url: "/v1/storage/sign", payload: { bucket: "learning", path: "lesson/material.pdf" } });
  assert.equal(response.statusCode, 200);
  assert.ok(response.json().token);
  await app.close();
});

test("intern dapat menandatangani lampiran task yang ditugaskan kepadanya", async () => {
  const app = await build(async (sql) => ({ rows: sql.includes("can_read_shared_attachment") ? [{ allowed: true }] : [] }));
  const response = await app.inject({ method: "POST", url: "/v1/storage/sign", payload: { bucket: "task", path: "cards/brief.pdf" } });
  assert.equal(response.statusCode, 200);
  await app.close();
});

test("intern tidak dapat menandatangani objek domain yang tidak terkait", async () => {
  const app = await build(async () => ({ rows: [] }));
  const response = await app.inject({ method: "POST", url: "/v1/storage/sign", payload: { bucket: "learning", path: "other/private.pdf" } });
  assert.equal(response.statusCode, 403);
  await app.close();
});

test("hak baca domain tidak memberi hak hapus file milik staff", async () => {
  const queries = [];
  const app = await build(async (sql) => { queries.push(sql); return { rows: sql.includes("can_read_shared_attachment") ? [{ allowed: true }] : [] }; });
  const response = await app.inject({ method: "DELETE", url: "/v1/storage/learning/lesson/material.pdf" });
  assert.equal(response.statusCode, 403);
  assert.equal(queries.some((sql) => sql.startsWith("update academy_storage.objects")), false);
  await app.close();
});
