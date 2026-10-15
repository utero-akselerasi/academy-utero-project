import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { adminRoutes } from "../src/routes/admin.mjs";
import { attendanceRoutes } from "../src/routes/attendance.mjs";
import { dailyReportRoutes } from "../src/routes/daily-reports.mjs";

const userId = "11111111-1111-4111-8111-111111111111";
const settings = {
  checkInTime: "08:00",
  checkOutTime: "17:00",
  lateToleranceMinutes: 15,
  monthlyTargetHours: 120,
  allowGeofencing: false,
  officeLatitude: null,
  officeLongitude: null,
  radiusMeters: 100,
};

async function fixture(identity, routes, query = async () => ({ rows: [], rowCount: 0 })) {
  const app = Fastify();
  const transactions = [];
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => { request.identity = identity; });
  const db = {
    transaction: async (actor, callback) => {
      transactions.push(actor);
      return callback({ query });
    },
  };
  await app.register(routes, { db, config: {} });
  return { app, transactions };
}

test("role school tidak dapat memakai permission bersama untuk membuka endpoint admin global", async () => {
  const school = {
    id: userId,
    roles: ["school"],
    permissions: ["interns.read", "attendance.review"],
  };
  const { app, transactions } = await fixture(school, adminRoutes, () => { throw new Error("database must not be touched"); });

  assert.equal((await app.inject("/v1/admin/dashboard")).statusCode, 403);
  assert.equal((await app.inject("/v1/admin/placements")).statusCode, 403);
  assert.equal(transactions.length, 0);
  await app.close();
});

test("role school tidak dapat mengubah attendance settings global", async () => {
  const school = {
    id: userId,
    roles: ["school"],
    permissions: ["attendance.review"],
  };
  const { app, transactions } = await fixture(school, attendanceRoutes, () => { throw new Error("database must not be touched"); });

  assert.equal((await app.inject({ method: "PATCH", url: "/v1/attendance/settings", payload: settings })).statusCode, 403);
  assert.equal(transactions.length, 0);
  await app.close();
});

test("role school tidak dapat masuk endpoint mentor atau review walau permission seed sama", async () => {
  const school = {
    id: userId,
    roles: ["school"],
    permissions: ["attendance.review", "daily_reports.review"],
  };
  const attendanceFixture = await fixture(school, attendanceRoutes, () => { throw new Error("database must not be touched"); });
  const reportFixture = await fixture(school, dailyReportRoutes, () => { throw new Error("database must not be touched"); });
  const resourceId = "22222222-2222-4222-8222-222222222222";

  assert.equal((await attendanceFixture.app.inject("/v1/attendance/mentor-dashboard")).statusCode, 403);
  assert.equal((await attendanceFixture.app.inject("/v1/attendance/export-data?startDate=2026-10-01&endDate=2026-10-14")).statusCode, 403);
  assert.equal((await attendanceFixture.app.inject({ method: "PATCH", url: `/v1/attendance/${resourceId}/review`, payload: { status: "valid" } })).statusCode, 403);
  assert.equal((await attendanceFixture.app.inject({ method: "PATCH", url: `/v1/attendance/permits/${resourceId}/review`, payload: { status: "approved" } })).statusCode, 403);
  assert.equal((await reportFixture.app.inject({ method: "PATCH", url: `/v1/daily-reports/${resourceId}/review`, payload: { status: "approved" } })).statusCode, 403);
  assert.equal(attendanceFixture.transactions.length, 0);
  assert.equal(reportFixture.transactions.length, 0);
  await attendanceFixture.app.close();
  await reportFixture.app.close();
});

test("role admin dengan permission seed tetap dapat memakai endpoint positif", async () => {
  const admin = {
    id: userId,
    roles: ["admin"],
    permissions: ["interns.read", "attendance.review"],
  };
  const query = async (sql) => {
    if (sql.includes("select count(*)::int total")) return { rows: [{ total: 0, present: 0 }], rowCount: 1 };
    if (sql.includes("select\n          (select count")) return { rows: [{ total_interns: 0, total_schools: 0, total_tasks: 0, completed_tasks: 0 }], rowCount: 1 };
    if (sql.includes("insert into utero_academy.attendance_settings")) return { rows: [], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  };
  const adminFixture = await fixture(admin, adminRoutes, query);
  const attendanceFixture = await fixture(admin, attendanceRoutes, query);

  assert.equal((await adminFixture.app.inject("/v1/admin/dashboard")).statusCode, 200);
  assert.equal((await attendanceFixture.app.inject({ method: "PATCH", url: "/v1/attendance/settings", payload: settings })).statusCode, 200);
  assert.equal(adminFixture.transactions.length, 1);
  assert.equal(attendanceFixture.transactions.length, 1);
  await adminFixture.app.close();
  await attendanceFixture.app.close();
});
