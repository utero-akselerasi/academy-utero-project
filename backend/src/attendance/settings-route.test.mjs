import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { attendanceRoutes } from "../routes/attendance.mjs";

const identity = { id: "33333333-3333-4333-8333-333333333333", roles: ["admin"], permissions: ["attendance.review"] };
const settings = { checkInTime: "08:00", checkOutTime: "17:00", lateToleranceMinutes: 15, monthlyTargetHours: 120, allowGeofencing: false, officeLatitude: -6.2, officeLongitude: 106.8, radiusMeters: 100 };

test("settings endpoint validates values and preserves coordinates while off", async () => {
  const calls = [];
  const app = Fastify();
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => { request.identity = identity; });
  await app.register(attendanceRoutes, { config: {}, db: { transaction: async (_actor, callback) => callback({ query: async (sql, values) => { calls.push({ sql, values }); return { rows: [], rowCount: 1 }; } }) } });
  try {
    const patch = (body) => app.inject({ method: "PATCH", url: "/v1/attendance/settings", payload: body });
    assert.equal((await patch(settings)).statusCode, 200);
    assert.deepEqual(calls[0].values.slice(6, 8), [-6.2, 106.8]);
    for (const invalid of [{ checkInTime: "24:00" }, { checkOutTime: "08:00" }, { lateToleranceMinutes: 181 }, { radiusMeters: -1 }, { officeLatitude: 91 }, { officeLongitude: -181 }, { allowGeofencing: true, officeLatitude: null, officeLongitude: null }]) {
      assert.equal((await patch({ ...settings, ...invalid })).statusCode, 400, JSON.stringify(invalid));
    }
    assert.equal((await patch({ ...settings, officeLatitude: null, officeLongitude: null })).statusCode, 200);
    assert.deepEqual(calls[1].values.slice(6, 8), [null, null]);
    assert.equal(calls.length, 2);
  } finally { await app.close(); }
});
