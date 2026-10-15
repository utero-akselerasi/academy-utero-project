import test from "node:test";
import assert from "node:assert/strict";
import { dailyReportRoutes } from "../routes/daily-reports.mjs";

test("daily reports route plugin exposes expected contract", async () => {
  const routes = [];
  const app = new Proxy({}, { get: (_target, method) => (path, options, handler) => {
    routes.push(`${String(method).toUpperCase()} ${path}`);
    assert.equal(typeof (handler || options), "function");
  } });
  await dailyReportRoutes(app, { db: {}, config: {} });
  assert.deepEqual(routes, [
    "GET /v1/daily-reports/intern/:id", "GET /v1/daily-reports/profile", "GET /v1/daily-reports", "GET /v1/daily-reports/:id/reviews",
    "POST /v1/daily-reports", "PATCH /v1/daily-reports/:id/review",
  ]);
});
