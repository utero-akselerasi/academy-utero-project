import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { profileRoutes } from "../src/routes/profiles.mjs";

const userId = "11111111-1111-4111-8111-111111111111";
const mentorId = "22222222-2222-4222-8222-222222222222";
const internId = "33333333-3333-4333-8333-333333333333";

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

test("staff scope restricts assignments to current mentor and Jakarta date", async () => {
  const identity = { id: userId, roles: ["admin"], permissions: ["interns.read"] };
  const { app, queries, transactions } = await fixture(identity, [[{ id: mentorId }], [{ intern_id: internId }]]);
  assert.deepEqual((await app.inject("/v1/profile/staff-scope")).json(), { kind: "scoped", internIds: [internId] });
  assert.deepEqual(transactions, [identity]);
  assert.deepEqual(queries.map((query) => query.params), [[userId], [mentorId]]);
  assert.match(queries[1].sql, /started_at <= \(now\(\) at time zone 'Asia\/Jakarta'\)::date/);
  assert.match(queries[1].sql, /ended_at is null or ended_at >=/);
  await app.close();
});

test("staff without mentor profile requires setup, not global access", async () => {
  const { app, queries } = await fixture({ id: userId, roles: ["admin"], permissions: ["interns.read"] }, [[]]);
  assert.deepEqual((await app.inject("/v1/profile/staff-scope")).json(), { kind: "setup_required" });
  assert.equal(queries.length, 1);
  await app.close();
});
