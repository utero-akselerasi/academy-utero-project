import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { attendanceRoutes } from "../routes/attendance.mjs";

const assignedIntern = "11111111-1111-4111-8111-111111111111";
const otherIntern = "22222222-2222-4222-8222-222222222222";
const identity = {
  id: "33333333-3333-4333-8333-333333333333",
  roles: ["admin"],
  permissions: ["attendance.review"],
};

async function makeApp(calls) {
  const app = Fastify();
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => { request.identity = request.headers["x-test-role"] === "intern" ? {
    id: identity.id, roles: ["intern"], permissions: ["attendance.submit"],
  } : identity; });
  await app.register(attendanceRoutes, { config: {}, db: {
    transaction: async (_identity, callback) => callback({
      query: async (sql, values) => {
        calls.push({ sql, values });
        if (sql.includes("from utero_academy.mentor_profiles")) return { rows: [{ id: "44444444-4444-4444-8444-444444444444" }] };
        if (sql.includes("from utero_academy.mentor_assignments")) return { rows: [{ intern_id: assignedIntern }] };
        if (sql.includes("from utero_academy.attendance_settings")) return { rows: [{ check_in_time: "08:00" }] };
        if (sql.includes("from utero_academy.intern_profiles ip where ip.status")) return { rows: [{ id: assignedIntern, full_name: "Assigned" }, { id: otherIntern, full_name: "Unassigned" }] };
        if (sql.includes("from utero_academy.intern_profiles\n")) return { rows: [{ id: assignedIntern, full_name: "Assigned", email: "assigned@example.test" }, { id: otherIntern, full_name: "Unassigned", email: "unassigned@example.test" }] };
        if (sql.includes("from utero_academy.attendances")) return { rows: [{ intern_id: assignedIntern, attendance_date: "2026-10-14" }, { intern_id: otherIntern, attendance_date: "2026-10-14" }] };
        return { rows: [] };
      },
    }),
  } });
  return app;
}

test("admin dashboard menampilkan seluruh peserta aktif tanpa bergantung pada assignment legacy", async () => {
  const calls = [];
  const app = await makeApp(calls);
  try {
    const response = await app.inject({ url: "/v1/attendance/admin-dashboard" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().interns.map((row) => row.id), [assignedIntern, otherIntern]);
    assert.equal(calls.some((entry) => entry.sql.includes("from utero_academy.mentor_assignments")), false);
    const internRead = calls.find((entry) => entry.sql.includes("from utero_academy.intern_profiles ip where ip.status = 'active'"));
    assert.ok(internRead);
    assert.ok(internRead.sql.includes("ip.end_date::text as end_date"));
    assert.equal(internRead.sql.includes("user_roles"), false);
    assert.equal(internRead.sql.includes("join utero_academy.roles"), false);
    const attendanceRead = calls.find((entry) => entry.sql.includes("from utero_academy.attendances"));
    assert.deepEqual(attendanceRead.values, [[assignedIntern, otherIntern]]);
    assert.ok(attendanceRead.sql.includes("select a.*, a.attendance_date::text as attendance_date"));
    assert.match(attendanceRead.sql, /order by a.attendance_date desc/);
  } finally { await app.close(); }
});

test("admin export memuat semua peserta aktif dan mencatat audit", async () => {
  const calls = [];
  const app = await makeApp(calls);
  try {
    const response = await app.inject({ url: "/v1/attendance/export-data?startDate=2026-10-01&endDate=2026-10-14&mode=range" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().interns.map((row) => row.id), [assignedIntern, otherIntern]);
    const internRead = calls.find((entry) => entry.sql.includes("from utero_academy.intern_profiles\n"));
    assert.ok(internRead.sql.includes("start_date::text as start_date"));
    assert.ok(internRead.sql.includes("end_date::text as end_date"));
    assert.ok(calls.find((entry) => entry.sql.includes("from utero_academy.intern_profiles\n"))?.sql.includes("end_date::text as end_date"));
    assert.deepEqual(calls.find((entry) => entry.sql.includes("between $2 and $3")).values, [[assignedIntern, otherIntern], "2026-10-01", "2026-10-14"]);
    assert.equal(calls.filter((entry) => entry.sql.includes("utero_academy.append_audit_log")).length, 1);
    const denied = await app.inject({ url: "/v1/attendance/export-data?startDate=2026-10-01&endDate=2026-10-14", headers: { "x-test-role": "intern" } });
    assert.equal(denied.statusCode, 403);
  } finally { await app.close(); }
});
