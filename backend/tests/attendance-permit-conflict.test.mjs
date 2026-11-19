import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { attendanceRoutes } from "../src/routes/attendance.mjs";
import { getBucket } from "../src/storage/buckets.mjs";

const actorId = "11111111-1111-4111-8111-111111111111";
const internId = "22222222-2222-4222-8222-222222222222";
const permitId = "33333333-3333-4333-8333-333333333333";

async function fixture(identity, query, options = {}) {
  const app = Fastify();
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => { request.identity = identity; });
  const db = {
    query: options.objectQuery ?? (async () => ({ rows: [] })),
    transaction: async (_identity, callback) => callback({ query }),
  };
  await app.register(attendanceRoutes, { db, config: { storageRoot: options.storageRoot } });
  return app;
}

test("izin tidak dapat mengganti absensi check-in yang sudah tercatat", async () => {
  const queries = [];
  const app = await fixture({ id: actorId, roles: ["super_admin"], permissions: ["attendance.review"] }, async (sql) => {
    queries.push(sql);
    if (sql.includes("from utero_academy.permits")) return { rows: [{ id: permitId, intern_id: internId, start_date: "2026-10-19", end_date: "2026-10-19" }] };
    if (sql.includes("attendance_date = any")) return { rows: [{ '?column?': 1 }] };
    return { rows: [] };
  });
  const response = await app.inject({ method: "PATCH", url: "/v1/attendance/permits/" + permitId + "/review", payload: { status: "approved" } });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error, "attendance_conflict");
  assert.equal(queries.some((sql) => sql.startsWith("update utero_academy.permits") || sql.startsWith("insert into utero_academy.attendances")), false);
  await app.close();
});

test("pengajuan izin menolak rentang lebih dari 366 hari sebelum akses database", async () => {
  let touched = false;
  const app = await fixture({ id: actorId, roles: ["intern"], permissions: ["attendance.submit"] }, async () => { touched = true; });
  const response = await app.inject({ method: "POST", url: "/v1/attendance/permits", payload: {
    permitType: "permit", startDate: "2026-01-01", endDate: "2027-01-02", reason: "Izin panjang",
  } });
  assert.equal(response.statusCode, 400);
  assert.equal(touched, false);
  await app.close();
});

test("pengajuan izin menolak rentang yang tumpang tindih", async () => {
  const app = await fixture({ id: actorId, roles: ["intern"], permissions: ["attendance.submit"] }, async (sql) => {
    if (sql.includes("from utero_academy.intern_profiles")) return { rows: [{ id: internId }] };
    if (sql.includes("pg_advisory_xact_lock")) return { rows: [] };
    if (sql.includes("from utero_academy.permits")) return { rows: [{ '?column?': 1 }] };
    throw new Error("query tidak diharapkan: " + sql);
  });
  const response = await app.inject({ method: "POST", url: "/v1/attendance/permits", payload: {
    permitType: "permit", startDate: "2026-10-26", endDate: "2026-10-27", reason: "Keperluan keluarga",
  } });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error, "permit_exists");
  await app.close();
});

test("daftar izin hanya membaca pengajuan milik peserta", async () => {
  const queries = [];
  const app = await fixture({ id: actorId, roles: ["intern"], permissions: ["attendance.submit"] }, async (sql, values) => {
    queries.push({ sql, values });
    if (sql.includes("from utero_academy.intern_profiles")) return { rows: [{ id: internId }] };
    if (sql.includes("from utero_academy.permits")) return { rows: [{ id: permitId, intern_id: internId, status: "pending" }] };
    throw new Error("query tidak diharapkan: " + sql);
  });
  const response = await app.inject({ method: "GET", url: "/v1/attendance/permits?internId=" + actorId });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().permits.map((permit) => permit.id), [permitId]);
  assert.deepEqual(queries.at(-1).values, [internId]);
  await app.close();
});

test("check-out luar radius meminta alasan dan bukti", async () => {
  const app = await fixture({ id: actorId, roles: ["intern"], permissions: ["attendance.submit"] }, async (sql) => {
    if (sql.includes("from utero_academy.intern_profiles")) return { rows: [{ id: internId }] };
    if (sql.includes("from utero_academy.attendance_settings")) return { rows: [{
      allow_geofencing: true, office_latitude: -7.9671, office_longitude: 112.6375, radius_meters: 100,
    }] };
    throw new Error("query tidak diharapkan: " + sql);
  });
  const response = await app.inject({ method: "POST", url: "/v1/attendance/check-out", payload: {
    latitude: -6.2,
    longitude: 106.8,
    selfieDataUrl: "data:image/jpeg;base64,YQ==",
  } });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "out_of_range_proof_required");
  await app.close();
});

test("check-out luar radius menyimpan bukti dan masuk review manual", async () => {
  const storageRoot = await mkdtemp(path.join(os.tmpdir(), "academy-attendance-"));
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const queries = [];
  const app = await fixture({ id: actorId, roles: ["intern"], permissions: ["attendance.submit"] }, async (sql, values) => {
    queries.push({ sql, values });
    if (sql.includes("from utero_academy.intern_profiles")) return { rows: [{ id: internId }] };
    if (sql.includes("from utero_academy.attendance_settings")) return { rows: [{
      allow_geofencing: true, office_latitude: -7.9671, office_longitude: 112.6375, radius_meters: 100,
    }] };
    if (sql.startsWith("update utero_academy.attendances")) return { rows: [{ id: "44444444-4444-4444-8444-444444444444" }] };
    throw new Error("query tidak diharapkan: " + sql);
  }, { storageRoot });
  try {
    const response = await app.inject({ method: "POST", url: "/v1/attendance/check-out", payload: {
      latitude: -6.2,
      longitude: 106.8,
      selfieDataUrl: png,
      outOfRangeReason: "Kunjungan industri",
      outOfRangeProof: { dataUrl: png, fileName: "bukti.png" },
    } });
    assert.equal(response.statusCode, 200);
    const update = queries.find((entry) => entry.sql.startsWith("update utero_academy.attendances"));
    assert.match(update.sql, /check_out_is_out_of_range/);
    assert.equal(update.values[6], true);
    assert.equal(update.values[7], "Kunjungan industri");
  } finally {
    await app.close();
    await rm(storageRoot, { recursive: true, force: true });
  }
});

test("check-out tanpa check-in tidak sukses dan membersihkan foto", async () => {
  const storageRoot = await mkdtemp(path.join(os.tmpdir(), "academy-attendance-"));
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const queries = [];
  const app = await fixture({ id: actorId, roles: ["intern"], permissions: ["attendance.submit"] }, async (sql) => {
    queries.push(sql);
    if (sql.includes("from utero_academy.intern_profiles")) return { rows: [{ id: internId }] };
    if (sql.includes("from utero_academy.attendance_settings")) return { rows: [{ allow_geofencing: false }] };
    if (sql.startsWith("update utero_academy.attendances")) return { rows: [] };
    throw new Error("query tidak diharapkan: " + sql);
  }, { storageRoot });
  try {
    const response = await app.inject({ method: "POST", url: "/v1/attendance/check-out", payload: {
      latitude: -7.9671, longitude: 112.6375, selfieDataUrl: png,
    } });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().error, "check_in_required");
    assert.match(queries.find((sql) => sql.startsWith("update utero_academy.attendances")), /check_in_at is not null and check_out_at is null/);
    assert.deepEqual(await readdir(path.join(storageRoot, "academy-private", actorId, "attendance")), []);
  } finally {
    await app.close();
    await rm(storageRoot, { recursive: true, force: true });
  }
});

test("bucket lampiran laporan menerima format yang divalidasi frontend", () => {
  const allowed = getBucket("daily-report").mime;
  assert.ok(allowed.includes("image/gif"));
  assert.ok(allowed.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
});
