import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { runRoleSmoke, writeRoleSmokeEvidence } from "../scripts/smoke-roles.mjs";

const roles = ["super_admin", "admin", "school", "intern", "applicant"];

function environment() {
  return Object.fromEntries([
    ["ACADEMY_API_BASE_URL", "http://api:3001"],
    ["SMOKE_DEFAULT_PASSWORD", "password-kuat-123"],
    ...roles.map((role) => [`SMOKE_${role.toUpperCase()}_EMAIL`, `${role}@example.test`]),
  ]);
}

test("smoke lima role memverifikasi login, identity, dan endpoint domain", async () => {
  const calls = [];
  let currentEmail = null;
  const request = async (url, options = {}) => {
    calls.push([String(url), options]);
    const path = new URL(url).pathname;
    if (path === "/v1/auth/login") {
      currentEmail = JSON.parse(options.body).email;
      return new Response("{}", { status: 200, headers: { "set-cookie": `utero_session=${"x".repeat(43)}; Path=/; HttpOnly; SameSite=Lax; Secure` } });
    }
    if (path === "/v1/auth/me" && !options.headers) return Response.json({ error: "authentication_required" }, { status: 401 });
    if (path === "/v1/auth/me") {
      return Response.json({ user: { roles: [currentEmail.split("@")[0]] } });
    }
    if (path === "/v1/super-admin/diagnostics" && currentEmail !== "super_admin@example.test") {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    if (path === "/v1/admin/applications") return Response.json({ error: "forbidden" }, { status: 403 });
    return Response.json({ ok: true });
  };
  const dates = [new Date("2026-10-15T10:00:00.000Z"), new Date("2026-10-15T10:00:01.000Z")];
  const report = await runRoleSmoke({ ...environment(), ROLE_SMOKE_TARGET: "production" }, request, () => dates.shift());
  assert.deepEqual(report.results.map((item) => item.role), roles);
  assert.deepEqual({ ...report, results: undefined }, {
    schemaVersion: 1,
    gate: "roleSmoke",
    target: "production",
    startedAt: "2026-10-15T10:00:00.000Z",
    finishedAt: "2026-10-15T10:00:01.000Z",
    expiresAt: "2026-10-16T10:00:01.000Z",
    status: "PASS",
    anonymousStatus: 401,
    negativeChecks: 4,
    secureCookies: 5,
    results: undefined,
  });
  assert.equal(calls.length, 20);
  assert.ok(calls.filter(([url, options]) => url.endsWith("/v1/auth/me") && options.headers).every(([, options]) => options.headers.cookie.startsWith("utero_session=")));
});

test("smoke gagal bila role akun tidak sesuai", async () => {
  const request = async (url, options) => new URL(url).pathname === "/v1/auth/login"
    ? new Response("{}", { status: 200, headers: { "set-cookie": `utero_session=${"x".repeat(43)}; Path=/` } })
    : Response.json({ user: { roles: ["applicant"] } }, { status: options?.headers ? 200 : 401 });
  const report = await runRoleSmoke(environment(), request);
  assert.equal(report.target, "local");
  assert.equal(report.status, "FAIL");
  assert.equal(report.results[0].status, 0);
});

test("smoke production gagal bila cookie sesi tidak Secure", async () => {
  const request = async (url, options) => new URL(url).pathname === "/v1/auth/login"
    ? new Response("{}", { status: 200, headers: { "set-cookie": `utero_session=${"x".repeat(43)}; Path=/; HttpOnly` } })
    : Response.json(options?.headers ? { user: { roles: ["super_admin"] } } : { error: "authentication_required" },
      { status: options?.headers ? 200 : 401 });
  const report = await runRoleSmoke({ ...environment(), ROLE_SMOKE_TARGET: "production" }, request);
  assert.equal(report.status, "FAIL");
  assert.equal(report.secureCookies, 0);
});

test("evidence output wajib absolut dan ditulis sebagai JSON", async () => {
  const output = path.join(tmpdir(), `academy-role-smoke-${process.pid}-${Date.now()}.json`);
  const report = { schemaVersion: 1, gate: "roleSmoke", status: "PASS" };
  await assert.rejects(writeRoleSmokeEvidence(report, "relative.json"), /path absolut/);
  assert.equal(await writeRoleSmokeEvidence(report, output), output);
  assert.deepEqual(JSON.parse(await readFile(output, "utf8")), report);
});
