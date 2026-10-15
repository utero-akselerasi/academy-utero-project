import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { dailyReportRoutes } from "../src/routes/daily-reports.mjs";

const allowedIntern = "11111111-1111-4111-8111-111111111111";
const otherIntern = "22222222-2222-4222-8222-222222222222";
const mentor = "44444444-4444-4444-8444-444444444444";

test("profil print hanya terbaca oleh admin pembimbing yang ditugaskan", async () => {
  const profileReads = [];
  const app = Fastify();
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => {
    request.identity = { id: "33333333-3333-4333-8333-333333333333", roles: ["admin"], permissions: ["daily_reports.review"] };
  });
  await app.register(dailyReportRoutes, { config: {}, db: {
    transaction: async (_identity, callback) => callback({ query: async (sql, values) => {
      if (sql.includes("from utero_academy.mentor_profiles")) return { rows: [{ id: mentor }] };
      if (sql.includes("from utero_academy.mentor_assignments")) return { rows: [{ intern_id: allowedIntern }] };
      if (sql.includes("from utero_academy.intern_profiles ip left join")) {
        profileReads.push(values[0]);
        return { rows: [{ id: values[0], full_name: "Assigned" }] };
      }
      return { rows: [] };
    } }),
  } });
  try {
    const denied = await app.inject({ url: `/v1/daily-reports/intern/${otherIntern}` });
    assert.equal(denied.statusCode, 404);
    assert.deepEqual(profileReads, []);
    const allowed = await app.inject({ url: `/v1/daily-reports/intern/${allowedIntern}` });
    assert.equal(allowed.statusCode, 200);
    assert.deepEqual(profileReads, [allowedIntern]);
  } finally { await app.close(); }
});

test("laporan print hanya terbaca untuk peserta dalam scope pembimbing", async () => {
  const reportReads = [];
  const app = Fastify();
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => {
    request.identity = { id: "33333333-3333-4333-8333-333333333333", roles: ["admin"], permissions: ["daily_reports.review"] };
  });
  await app.register(dailyReportRoutes, { config: {}, db: {
    transaction: async (_identity, callback) => callback({ query: async (sql, values) => {
      if (sql.includes("from utero_academy.mentor_profiles")) return { rows: [{ id: mentor }] };
      if (sql.includes("from utero_academy.mentor_assignments")) return { rows: [{ intern_id: allowedIntern }] };
      if (sql.includes("from utero_academy.daily_reports")) {
        reportReads.push(values[0]);
        return { rows: [{ id: "55555555-5555-4555-8555-555555555555", intern_id: allowedIntern, report_date: "2026-10-15" }] };
      }
      if (sql.includes("from utero_academy.daily_report_attachments")) return { rows: [] };
      return { rows: [] };
    } }),
  } });
  try {
    const denied = await app.inject({ url: `/v1/daily-reports?internId=${otherIntern}` });
    assert.equal(denied.statusCode, 404);
    assert.deepEqual(reportReads, []);
    const allowed = await app.inject({ url: `/v1/daily-reports?internId=${allowedIntern}` });
    assert.equal(allowed.statusCode, 200);
    assert.deepEqual(reportReads, [[allowedIntern]]);
    assert.equal(allowed.json().reports[0].intern_id, allowedIntern);
  } finally { await app.close(); }
});
