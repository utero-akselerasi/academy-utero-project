import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { adminRoutes } from "../src/routes/admin.mjs";

const id = "11111111-1111-4111-8111-111111111111";
const staff = { id, userId: id, roles: ["admin"], permissions: ["programs.manage"] };
const input = { name: "Magang Multimedia", description: "Untuk pemula", type: "internship", status: "published" };

async function fixture(identity, query = async () => ({ rows: [], rowCount: 0 })) {
  const app = Fastify();
  const transactions = [];
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => { request.identity = identity; });
  const db = { transaction: async (actor, callback) => { transactions.push(actor); return callback({ query }); } };
  await app.register(adminRoutes, { db });
  return { app, transactions };
}

test("program hanya dapat dibaca dan diubah oleh admin dengan izin", async () => {
  for (const identity of [null, { id, roles: ["applicant"], permissions: [] }, { id, roles: ["admin"], permissions: [] }]) {
    const { app, transactions } = await fixture(identity, () => { throw Error("database must not be touched"); });
    for (const [method, url, payload] of [
      ["GET", "/v1/admin/programs"],
      ["POST", "/v1/admin/programs", input],
      ["PATCH", `/v1/admin/programs/${id}`, input],
    ]) assert.equal((await app.inject({ method, url, payload })).statusCode, identity ? 403 : 401);
    assert.equal(transactions.length, 0);
    await app.close();
  }
});

test("program terbit dibuat dan dicatat sebagai audit dalam transaksi user", async () => {
  const queries = [];
  const program = { id, ...input, slug: "magang-multimedia" };
  const { app, transactions } = await fixture(staff, async (sql, values) => {
    queries.push({ sql, values });
    return { rows: sql.includes("returning id") ? [program] : [program], rowCount: 1 };
  });
  const response = await app.inject({ method: "POST", url: "/v1/admin/programs", payload: input });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().program.slug, program.slug);
  assert.deepEqual(queries[0].values, ["Magang Multimedia", "magang-multimedia", "Untuk pemula", "internship", "published"]);
  assert.equal(queries[1].values[0], "create_program");
  assert.deepEqual(transactions, [staff]);
  await app.close();
});

test("update dan arsip program tidak menghapus rekam pendaftaran", async () => {
  const queries = [];
  const { app } = await fixture(staff, async (sql, values) => {
    queries.push({ sql, values });
    return { rows: [{ id, status: "archived" }], rowCount: 1 };
  });
  const result = await app.inject({ method: "PATCH", url: `/v1/admin/programs/${id}`, payload: { ...input, status: "archived" } });
  assert.equal(result.statusCode, 200);
  assert.match(queries[0].sql, /^update utero_academy.programs/);
  assert.equal(queries[0].values[5], "archived");
  assert.equal(queries[1].values[0], "update_program");
  await app.close();
});

test("validasi menolak data dan ID buruk tanpa mengakses database", async () => {
  const { app, transactions } = await fixture(staff, () => { throw Error("database must not be touched"); });
  assert.equal((await app.inject({ method: "POST", url: "/v1/admin/programs", payload: { ...input, name: "" } })).statusCode, 400);
  assert.equal((await app.inject({ method: "POST", url: "/v1/admin/programs", payload: { ...input, status: "public" } })).statusCode, 400);
  assert.equal((await app.inject({ method: "PATCH", url: "/v1/admin/programs/invalid", payload: input })).statusCode, 400);
  assert.equal(transactions.length, 0);
  await app.close();
});

test("slug duplikat menghasilkan konflik", async () => {
  const { app } = await fixture(staff, async () => { throw Object.assign(new Error("duplicate"), { code: "23505" }); });
  const response = await app.inject({ method: "POST", url: "/v1/admin/programs", payload: input });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error, "program_slug_taken");
  await app.close();
});
