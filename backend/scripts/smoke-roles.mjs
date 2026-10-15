import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MAX_EVIDENCE_AGE_MS = 24 * 60 * 60 * 1000;

const ROLE_CHECKS = [
  ["super_admin", "SMOKE_SUPER_ADMIN_EMAIL", "/v1/super-admin/diagnostics", null],
  ["admin", "SMOKE_ADMIN_EMAIL", "/v1/admin/dashboard", "/v1/super-admin/diagnostics"],
  ["school", "SMOKE_SCHOOL_EMAIL", "/v1/school/context", "/v1/super-admin/diagnostics"],
  ["intern", "SMOKE_INTERN_EMAIL", "/v1/attendance", "/v1/admin/applications"],
  ["applicant", "SMOKE_APPLICANT_EMAIL", "/v1/registration/dashboard", "/v1/admin/applications"],
];

function required(environment, name) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} wajib diisi`);
  return value;
}

function sessionCookie(response) {
  const header = response.headers.get("set-cookie") ?? "";
  const match = /(?:^|,\s*)(utero_session=[A-Za-z0-9_-]{43})(?:;|$)/.exec(header);
  if (!match) throw new Error("Login tidak mengembalikan cookie sesi valid");
  return { cookie: match[1], secure: /(?:^|;)\s*Secure(?:;|$)/i.test(header) };
}

async function bodyText(response) {
  return (await response.text()).slice(0, 300);
}

export async function runRoleSmoke(environment = process.env, request = fetch, now = () => new Date()) {
  const base = new URL(required(environment, "ACADEMY_API_BASE_URL"));
  if (!/^https?:$/.test(base.protocol)) throw new Error("ACADEMY_API_BASE_URL wajib HTTP(S)");
  const target = environment.ROLE_SMOKE_TARGET?.trim() || "local";
  if (!new Set(["local", "production"]).has(target)) throw new Error("ROLE_SMOKE_TARGET wajib local atau production");
  const defaultPassword = environment.SMOKE_DEFAULT_PASSWORD;
  const startedAt = now();
  const results = [];
  let anonymousStatus = null;
  let negativeChecks = 0;
  let secureCookies = 0;

  try {
    const anonymous = await request(new URL("/v1/auth/me", base), { signal: AbortSignal.timeout(10_000) });
    anonymousStatus = anonymous.status;
  } catch {
    anonymousStatus = 0;
  }

  for (const [role, emailName, endpoint, forbiddenEndpoint] of ROLE_CHECKS) {
    const result = { role, endpoint, status: 0, forbiddenEndpoint, forbiddenStatus: forbiddenEndpoint ? 0 : null };
    try {
      const email = required(environment, emailName);
      const password = environment[`SMOKE_${role.toUpperCase()}_PASSWORD`] || defaultPassword;
      if (!password) throw new Error(`Password smoke ${role} wajib diisi`);
      const login = await request(new URL("/v1/auth/login", base), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!login.ok) throw new Error(`Login ${role} gagal (HTTP ${login.status}): ${await bodyText(login)}`);
      const session = sessionCookie(login);
      if (target === "production" && !session.secure) throw new Error(`Cookie sesi ${role} tidak memakai Secure`);
      if (session.secure) secureCookies += 1;
      const cookie = session.cookie;
      const headers = { cookie };
      const identityResponse = await request(new URL("/v1/auth/me", base), { headers, signal: AbortSignal.timeout(10_000) });
      if (!identityResponse.ok) throw new Error(`Identity ${role} gagal (HTTP ${identityResponse.status})`);
      const identity = await identityResponse.json();
      if (!identity.user?.roles?.includes(role)) throw new Error(`Akun ${email} tidak memiliki role ${role}`);
      const probe = await request(new URL(endpoint, base), { headers, signal: AbortSignal.timeout(15_000) });
      result.status = probe.status;
      if (!probe.ok) throw new Error(`Probe ${role} ${endpoint} gagal (HTTP ${probe.status}): ${await bodyText(probe)}`);
      if (forbiddenEndpoint) {
        const forbidden = await request(new URL(forbiddenEndpoint, base), { headers, signal: AbortSignal.timeout(15_000) });
        result.forbiddenStatus = forbidden.status;
        if (forbidden.status !== 403) throw new Error(`Probe negatif ${role} ${forbiddenEndpoint} wajib 403; diterima ${forbidden.status}`);
        negativeChecks += 1;
      }
    } catch {
      result.status = result.status || 0;
    }
    results.push(result);
  }

  const finishedAt = now();
  const passed = anonymousStatus === 401 && negativeChecks >= 4 &&
    results.every((result) => result.status >= 200 && result.status < 300 &&
      (!result.forbiddenEndpoint || result.forbiddenStatus === 403));
  return {
    schemaVersion: 1,
    gate: "roleSmoke",
    target,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    expiresAt: new Date(finishedAt.getTime() + MAX_EVIDENCE_AGE_MS).toISOString(),
    status: passed ? "PASS" : "FAIL",
    anonymousStatus,
    negativeChecks,
    secureCookies,
    results,
  };
}

export async function writeRoleSmokeEvidence(report, output) {
  if (!output) return null;
  if (!path.isAbsolute(output)) throw new Error("ROLE_SMOKE_OUTPUT wajib path absolut");
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  await rename(temporary, output);
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await runRoleSmoke();
    await writeRoleSmokeEvidence(report, process.env.ROLE_SMOKE_OUTPUT);
    console.log(JSON.stringify(report));
    if (report.status !== "PASS") process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
