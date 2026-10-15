import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { certificatesRoutes } from "../src/routes/certificates.mjs";

const schoolUserId = "11111111-1111-4111-8111-111111111111";
const internId = "22222222-2222-4222-8222-222222222222";
const identity = { id: schoolUserId, roles: ["school"], permissions: ["certificates.read"] };

async function fixture(query) {
  const app = Fastify();
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => { request.identity = identity; });
  const db = {
    transaction: async (actor, callback) => {
      assert.equal(actor, identity);
      return callback({ query });
    },
    query: async () => ({ rows: [], rowCount: 0 }),
  };
  await app.register(certificatesRoutes, { db, config: {} });
  return app;
}

for (const suffix of ["/context", ""]) {
  test(`certificate${suffix || "/detail"} menolak sekolah di luar scope`, async () => {
    const queries = [];
    const app = await fixture(async (sql, params) => {
      queries.push({ sql, params });
      return { rows: [], rowCount: 0 };
    });

    const response = await app.inject(`/v1/certificates/${internId}${suffix}`);

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), { error: suffix ? "intern_not_found" : "certificate_not_found" });
    assert.equal(queries.length, 2);
    assert.match(queries[1].sql, /school_contacts/);
    assert.deepEqual(queries[1].params, [internId, schoolUserId]);
    await app.close();
  });

  test(`certificate${suffix || "/detail"} menerima peserta dari sekolah yang sama`, async () => {
    const app = await fixture(async (sql) => {
      if (sql.includes("school_contacts")) return { rows: [{ exists: 1 }], rowCount: 1 };
      if (sql.includes("user_id=$2")) return { rows: [], rowCount: 0 };
      if (sql.includes("certificate_template_path")) return { rows: [{}], rowCount: 1 };
      if (sql.includes("from utero_academy.certificates")) {
        return { rows: [{ id: "33333333-3333-4333-8333-333333333333", intern_id: internId }], rowCount: 1 };
      }
      if (sql.includes("select full_name,email,major,status,school_id")) {
        return { rows: [{ full_name: "Peserta Scope", school_id: "44444444-4444-4444-8444-444444444444" }], rowCount: 1 };
      }
      throw new Error(`Query tidak diharapkan: ${sql}`);
    });

    const response = await app.inject(`/v1/certificates/${internId}${suffix}`);

    assert.equal(response.statusCode, 200);
    if (suffix) assert.equal(response.json().internProfile.full_name, "Peserta Scope");
    else assert.equal(response.json().certificate.intern_id, internId);
    await app.close();
  });
}
