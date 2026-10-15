import test from "node:test";
import assert from "node:assert/strict";
import { attendanceRoutes } from "../routes/attendance.mjs";

test("attendance route plugin exposes expected contract", async () => {
  const routes = [];
  const app = new Proxy({}, { get: (_target, method) => (path, options, handler) => {
    routes.push(`${String(method).toUpperCase()} ${path}`);
    assert.equal(typeof (handler || options), "function");
  } });
  await attendanceRoutes(app, { db: {}, config: {} });
  assert.deepEqual(routes, [
    "GET /v1/attendance/mentor-dashboard", "GET /v1/attendance/export-data", "GET /v1/attendance", "GET /v1/attendance/today", "POST /v1/attendance/check-in",
    "POST /v1/attendance/check-out", "POST /v1/attendance/permits", "PATCH /v1/attendance/:id/review",
    "PATCH /v1/attendance/permits/:id/review", "PATCH /v1/attendance/settings",
  ]);
});
