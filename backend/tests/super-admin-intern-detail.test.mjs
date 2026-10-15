import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { superAdminRoutes } from "../src/routes/super-admin.mjs";
import { tasksRoutes } from "../src/routes/tasks.mjs";

const callerId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const internId = "00000000-0000-4000-8000-000000000003";

async function appFor(identity, query) {
  const app = Fastify();
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => { request.identity = identity; });
  const transactions = [];
  const db = {
    async transaction(transactionIdentity, callback) {
      transactions.push(transactionIdentity);
      return callback({ query });
    },
  };
  await app.register(superAdminRoutes, { db, config: {} });
  await app.register(tasksRoutes, { db });
  return { app, transactions };
}

test("lookup detail intern hanya untuk super_admin dan memakai transaksi RLS caller", async () => {
  const query = async (sql) => {
    if (sql.includes("from utero_academy.user_profiles")) return { rows: [{ id: userId, full_name: "Peserta" }] };
    if (sql.includes("from utero_academy.intern_profiles")) return { rows: [{ id: internId, user_id: userId, schools: { name: "SMK" } }] };
    return { rows: [] };
  };
  const denied = await appFor({ id: callerId, roles: ["admin"], permissions: [] }, query);
  assert.equal((await denied.app.inject(`/v1/super-admin/users/${userId}/intern`)).statusCode, 403);
  assert.equal(denied.transactions.length, 0);
  await denied.app.close();

  const identity = { id: callerId, roles: ["super_admin"], permissions: [] };
  const allowed = await appFor(identity, query);
  const response = await allowed.app.inject(`/v1/super-admin/users/${userId}/intern`);
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().internProfile.id, internId);
  assert.equal(allowed.transactions[0], identity);
  await allowed.app.close();
});

test("super_admin dapat membaca task arbitrary internId tanpa memakai profil caller", async () => {
  const queries = [];
  const identity = { id: callerId, roles: ["super_admin"], permissions: [] };
  const { app, transactions } = await appFor(identity, async (sql, values) => {
    queries.push({ sql, values });
    if (sql.startsWith("select 1 from utero_academy.intern_profiles")) return { rows: [{ "?column?": 1 }], rowCount: 1 };
    if (sql.startsWith("select * from utero_academy.task_cards")) return { rows: [{ id: userId, intern_id: internId }] };
    return { rows: [] };
  });
  const response = await app.inject(`/v1/tasks/cards?internId=${internId}`);
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().cards[0].intern_id, internId);
  assert.equal(queries.some(({ sql }) => sql.includes("where user_id = $1")), false);
  assert.deepEqual(queries.find(({ sql }) => sql.startsWith("select * from utero_academy.task_cards")).values, [internId]);
  assert.equal(transactions.at(-1), identity);
  await app.close();
});

test("intern tetap tidak dapat meminta task milik intern lain", async () => {
  const identity = { id: callerId, roles: ["intern"], permissions: ["tasks.submit"] };
  const { app } = await appFor(identity, async (sql) => {
    if (sql.includes("where user_id = $1")) return { rows: [{ id: userId }] };
    if (sql.startsWith("select * from utero_academy.task_cards")) return { rows: [] };
    return { rows: [] };
  });
  assert.equal((await app.inject(`/v1/tasks/cards?internId=${internId}`)).statusCode, 404);
  await app.close();
});
