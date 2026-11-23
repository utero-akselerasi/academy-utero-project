import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { profileRoutes } from "../src/routes/profiles.mjs";

const userId = "11111111-1111-4111-8111-111111111111";

async function fixture(identity, rows = []) {
  const app = Fastify();
  const queries = [];
  const transactions = [];
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => { request.identity = identity; });
  await app.register(profileRoutes, { db: {
    transaction: async (actor, callback) => {
      transactions.push(actor);
      return callback({ query: async (sql, params) => {
        queries.push({ sql, params });
        return { rows: rows.shift() ?? [] };
      } });
    },
  } });
  return { app, queries, transactions };
}

test("staff scope rejects anonymous users and applicants before database access", async () => {
  for (const identity of [null, { id: userId, roles: ["applicant"], permissions: [] }]) {
    const { app, queries } = await fixture(identity);
    const response = await app.inject("/v1/profile/staff-scope");
    assert.equal(response.statusCode, identity ? 403 : 401);
    assert.equal(queries.length, 0);
    await app.close();
  }
});

test("super-admin sees global scope without querying assignments", async () => {
  const { app, queries } = await fixture({ id: userId, roles: ["super_admin"], permissions: [] });
  assert.deepEqual((await app.inject("/v1/profile/staff-scope")).json(), { kind: "global" });
  assert.equal(queries.length, 0);
  await app.close();
});

test("admin sees global scope without mentor assignments", async () => {
  const identity = { id: userId, roles: ["admin"], permissions: [] };
  const { app, queries, transactions } = await fixture(identity);
  assert.deepEqual((await app.inject("/v1/profile/staff-scope")).json(), { kind: "global" });
  assert.equal(queries.length, 0);
  assert.equal(transactions.length, 0);
  await app.close();
});
