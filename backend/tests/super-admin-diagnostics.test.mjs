import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { superAdminRoutes } from "../src/routes/super-admin.mjs";

test("diagnostik super-admin membatasi akses dan menghitung data yatim", async () => {
  const app = Fastify();
  let role = "school";
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => { request.identity = { id: "00000000-0000-4000-8000-000000000001", roles: [role] }; });
  const db = { async transaction(identity, callback) {
    assert.deepEqual(identity.roles, ["super_admin"]);
    const rows = [
      [{ id: "contact", user_id: null, school_id: "missing", name: "Kontak" }],
      [{ id: "intern", user_id: "user", school_id: "missing", full_name: "Peserta" }],
      [], [],
      [{ user_id: "user", code: "intern" }],
      [{ id: "user", full_name: "Peserta" }], []
    ];
    let index = 0;
    return callback({ query: async () => ({ rows: rows[index++] }) });
  } };
  await app.register(superAdminRoutes, { db, config: {} });
  assert.equal((await app.inject("/v1/super-admin/diagnostics")).statusCode, 403);
  role = "super_admin";
  const result = await app.inject("/v1/super-admin/diagnostics");
  assert.equal(result.statusCode, 200);
  assert.equal(result.json().orphanContacts.length, 1);
  assert.equal(result.json().orphanInterns.length, 1);
  assert.equal(result.json().missing.length, 0);
  await app.close();
});
