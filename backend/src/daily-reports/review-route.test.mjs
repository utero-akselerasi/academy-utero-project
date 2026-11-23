import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { dailyReportRoutes } from "../routes/daily-reports.mjs";

const reportId = "11111111-1111-4111-8111-111111111111";
const internId = "22222222-2222-4222-8222-222222222222";
const reviewerId = "33333333-3333-4333-8333-333333333333";
const mentorId = "44444444-4444-4444-8444-444444444444";

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
      if (sql.includes("from utero_academy.mentor_assignments")) return { rows: [] };
      if (sql.startsWith("select id from utero_academy.mentor_profiles")) return { rows: [] };
      if (sql.includes("with inserted as")) return { rows: [{ id: mentorId }] };
      return { rows: [] };
    } }),
  } });
  return { app, queries };
}

test("super admin tanpa mentor profile diprovisikan saat mereview", async () => {
  const { app, queries } = await buildApp(["super_admin"]);
  try {
    const response = await app.inject({ method: "PATCH", url: `/v1/daily-reports/${reportId}/review`, payload: { status: "approved" } });
    assert.equal(response.statusCode, 200);
    assert.equal(queries.some((sql) => sql.includes("with inserted as")), true);
    assert.equal(queries.some((sql) => sql.includes("insert into utero_academy.daily_report_reviews")), true);
  } finally { await app.close(); }
});

test("admin tanpa profil historis membuat profil untuk atribusi review", async () => {
  const { app, queries } = await buildApp(["admin"]);
  try {
    const response = await app.inject({ method: "PATCH", url: `/v1/daily-reports/${reportId}/review`, payload: { status: "approved" } });
    assert.equal(response.statusCode, 200);
    assert.equal(queries.some((sql) => sql.includes("with inserted as")), true);
  } finally { await app.close(); }
});
