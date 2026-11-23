import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { dailyReportRoutes } from "../routes/daily-reports.mjs";

const reportId = "11111111-1111-4111-8111-111111111111";
const internId = "22222222-2222-4222-8222-222222222222";
const reviewerId = "33333333-3333-4333-8333-333333333333";

async function buildApp(roles) {
  const queries = [];
  const app = Fastify();
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => {
    request.identity = { id: reviewerId, roles, permissions: ["daily_reports.review"] };
  });
  await app.register(dailyReportRoutes, { config: {}, db: {
    transaction: async (_identity, callback) => callback({ query: async (sql) => {
      queries.push(sql);
      if (sql.includes("select intern_id from utero_academy.daily_reports")) return { rows: [{ intern_id: internId }] };
      return { rows: [] };
    } }),
  } });
  return { app, queries };
}

test("super admin mereview dengan atribusi user tanpa membuat profil domain", async () => {
  const { app, queries } = await buildApp(["super_admin"]);
  try {
    const response = await app.inject({ method: "PATCH", url: `/v1/daily-reports/${reportId}/review`, payload: { status: "approved" } });
    assert.equal(response.statusCode, 200);
    assert.equal(queries.some((sql) => sql.includes("insert into utero_academy.daily_report_reviews (report_id,reviewed_by")), true);
    assert.equal(queries.some((sql) => sql.includes("mentor_profiles")), false);
  } finally { await app.close(); }
});

test("admin mereview dengan atribusi akun admin langsung", async () => {
  const { app, queries } = await buildApp(["admin"]);
  try {
    const response = await app.inject({ method: "PATCH", url: `/v1/daily-reports/${reportId}/review`, payload: { status: "approved" } });
    assert.equal(response.statusCode, 200);
    assert.equal(queries.some((sql) => sql.includes("insert into utero_academy.daily_report_reviews (report_id,reviewed_by")), true);
    assert.equal(queries.some((sql) => sql.includes("mentor_profiles")), false);
  } finally { await app.close(); }
});
