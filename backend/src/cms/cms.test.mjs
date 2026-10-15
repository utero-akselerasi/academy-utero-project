import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { cmsRoutes } from "../routes/cms.mjs";

const siteId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";

async function fixture(identity, query) {
  const app = Fastify();
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => { request.identity = identity; });
  const client = { query };
  await app.register(cmsRoutes, {
    db: {
      apiTransaction: async (callback) => callback(client),
      transaction: async (_identity, callback) => callback(client),
    },
  });
  return app;
}

test("CMS publik hanya meminta konten published", async () => {
  const sql = [];
  const app = await fixture(null, async (statement) => {
    sql.push(statement);
    return { rows: [], rowCount: 0 };
  });
  const response = await app.inject({ method: "GET", url: `/v1/cms/sites/${siteId}/content` });
  assert.equal(response.statusCode, 200);
  assert.equal(sql.length, 4);
  assert.ok(sql.every((statement) => statement.includes("status = 'published'")));
  await app.close();
});

test("CMS draft memerlukan cms.read", async () => {
  const denied = await fixture({ id: itemId, roles: ["intern"], permissions: [] }, async () => ({ rows: [] }));
  assert.equal((await denied.inject({ method: "GET", url: `/v1/cms/sites/${siteId}/content?includeDrafts=true` })).statusCode, 403);
  await denied.close();

  const allowed = await fixture({ id: itemId, roles: ["admin"], permissions: ["cms.read"] }, async () => ({ rows: [] }));
  assert.equal((await allowed.inject({ method: "GET", url: `/v1/cms/sites/${siteId}/content?includeDrafts=true` })).statusCode, 200);
  await allowed.close();
});

test("detail artikel publik hanya mengembalikan artikel published beserta author", async () => {
  const statements = [];
  const app = await fixture(null, async (statement, values) => {
    statements.push({ statement, values });
    return {
      rows: [{
        id: itemId,
        slug: "artikel-lokal",
        title: "Artikel Lokal",
        status: "published",
        author_name: "Admin Academy",
      }],
      rowCount: 1,
    };
  });
  const response = await app.inject({ method: "GET", url: "/v1/cms/articles/artikel-lokal" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().article.author_name, "Admin Academy");
  assert.equal(statements.length, 1);
  assert.match(statements[0].statement, /a\.status = 'published'/);
  assert.deepEqual(statements[0].values, ["artikel-lokal"]);
  await app.close();
});

test("detail artikel publik menolak slug buruk dan mengembalikan 404", async () => {
  let queryCount = 0;
  const app = await fixture(null, async () => {
    queryCount += 1;
    return { rows: [], rowCount: 0 };
  });
  assert.equal((await app.inject({ method: "GET", url: "/v1/cms/articles/Invalid_Slug" })).statusCode, 400);
  assert.equal(queryCount, 0);
  assert.equal((await app.inject({ method: "GET", url: "/v1/cms/articles/tidak-ada" })).statusCode, 404);
  assert.equal(queryCount, 1);
  await app.close();
});

test("CMS write menolak tanpa permission dan memvalidasi payload", async () => {
  const denied = await fixture({ id: itemId, roles: ["school"], permissions: ["cms.read"] }, async () => { throw new Error("DB tidak boleh disentuh"); });
  assert.equal((await denied.inject({ method: "DELETE", url: `/v1/cms/articles/${itemId}` })).statusCode, 403);
  await denied.close();

  const allowed = await fixture({ id: itemId, roles: ["admin"], permissions: ["cms.write"] }, async () => ({ rows: [], rowCount: 0 }));
  const invalid = await allowed.inject({ method: "POST", url: "/v1/cms/articles", payload: { siteId, title: "", content: "" } });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error, "invalid_cms_content");
  await allowed.close();
});
