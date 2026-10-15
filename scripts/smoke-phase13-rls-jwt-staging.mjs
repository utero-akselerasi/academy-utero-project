#!/usr/bin/env node
import { pathToFileURL } from "node:url";

const endpoint = "http://127.0.0.1:18100";
const personas = ["INTERN", "MENTOR", "SCHOOL", "ADMIN", "SUPER_ADMIN"];

function tokenPrincipal(token, persona, now) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error("JWT staging " + persona + " tidak valid");
  }
  try {
    const [header, payload, signature] = token.split(".");
    const algorithm = JSON.parse(Buffer.from(header, "base64url").toString("utf8")).alg;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof algorithm !== "string" || !/^(?:HS|RS|ES|PS)\d{3}$/.test(algorithm) || signature.length < 16 ||
        !/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(claims.sub ?? "") ||
        claims.role !== "authenticated" || !Number.isSafeInteger(claims.exp) || claims.exp <= now ||
        (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > now))) {
      throw new Error("JWT claims tidak cocok");
    }
    return claims.sub.toLowerCase();
  } catch {
    throw new Error("JWT staging " + persona + " tidak valid atau kedaluwarsa");
  }
}

export function validateJwtSmokeConfig(env) {
  if (env.SUPABASE_STAGING_URL !== endpoint || !env.SUPABASE_STAGING_ANON_KEY || env.SUPABASE_STAGING_ANON_KEY.length < 20) {
    throw new Error("Endpoint atau anon key staging tidak valid");
  }
  const now = Math.floor(Date.now() / 1000);
  const subjects = personas.map((persona) => tokenPrincipal(env["PHASE13_JWT_" + persona], persona, now));
  if (new Set(subjects).size !== personas.length) {
    throw new Error("JWT persona staging wajib berasal dari lima pengguna berbeda");
  }
  for (const name of ["PHASE13_RLS_INTERN_PROFILE_ID", "PHASE13_RLS_OTHER_INTERN_PROFILE_ID", "PHASE13_RLS_SCHOOL_ID", "PHASE13_RLS_OTHER_SCHOOL_INTERN_ID"]) {
    if (!/^[a-f0-9-]{36}$/i.test(env[name] ?? "")) throw new Error("Fixture ID staging tidak valid: " + name);
  }
  return true;
}

async function request(env, fetcher, path, token) {
  const response = await fetcher(endpoint + path, {
    method: "GET",
    headers: { apikey: env.SUPABASE_STAGING_ANON_KEY, ...(token ? { Authorization: "Bearer " + token } : {}),
      "Accept-Profile": "utero_academy" },
    redirect: "error", signal: AbortSignal.timeout(10000),
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, ok: response.ok, body };
}

async function roleCheck(env, fetcher, token, role) {
  const response = await request(env, fetcher, "/rest/v1/rpc/current_user_has_role?role_code=" + encodeURIComponent(role), token);
  return response.ok && response.body === true;
}

function rowsVisible(response) { return response.ok && Array.isArray(response.body) ? response.body.length : -1; }

export async function smokeJwtRlsStaging(env = process.env, fetcher = fetch) {
  validateJwtSmokeConfig(env);
  const tokens = Object.fromEntries(personas.map((name) => [name, env["PHASE13_JWT_" + name]]));
  const anon = await request(env, fetcher, "/rest/v1/user_profiles?select=id&limit=1", null);
  const internOwn = await request(env, fetcher, "/rest/v1/intern_profiles?select=id&id=eq." + env.PHASE13_RLS_INTERN_PROFILE_ID, tokens.INTERN);
  const internCross = await request(env, fetcher, "/rest/v1/intern_profiles?select=id&id=eq." + env.PHASE13_RLS_OTHER_INTERN_PROFILE_ID, tokens.INTERN);
  const schoolOwn = await request(env, fetcher, "/rest/v1/intern_profiles?select=id&school_id=eq." + env.PHASE13_RLS_SCHOOL_ID + "&limit=1", tokens.SCHOOL);
  const schoolCross = await request(env, fetcher, "/rest/v1/intern_profiles?select=id&id=eq." + env.PHASE13_RLS_OTHER_SCHOOL_INTERN_ID, tokens.SCHOOL);
  const results = {
    anon: !anon.ok && [401, 403, 406].includes(anon.status) ? "passed" : "failed",
    pesertaRole: await roleCheck(env, fetcher, tokens.INTERN, "intern") ? "passed" : "failed",
    pesertaOwn: rowsVisible(internOwn) === 1 ? "passed" : "failed",
    pesertaCrossTenant: rowsVisible(internCross) === 0 ? "passed" : "failed",
    mentorRole: await roleCheck(env, fetcher, tokens.MENTOR, "admin") ? "passed" : "failed",
    sekolahRole: await roleCheck(env, fetcher, tokens.SCHOOL, "school") ? "passed" : "failed",
    sekolahOwn: rowsVisible(schoolOwn) === 1 ? "passed" : "failed",
    sekolahCrossTenant: rowsVisible(schoolCross) === 0 ? "passed" : "failed",
    adminRole: await roleCheck(env, fetcher, tokens.ADMIN, "admin") ? "passed" : "failed",
    superAdminRole: await roleCheck(env, fetcher, tokens.SUPER_ADMIN, "super_admin") ? "passed" : "failed",
  };
  return { target: "staging", endpoint, mode: "signed-jwt-read-only", results,
    ready: Object.values(results).every((value) => value === "passed") };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  smokeJwtRlsStaging().then((report) => {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    if (!report.ready) process.exitCode = 1;
  }).catch((error) => { process.stderr.write("JWT RLS staging NO-GO: " + error.message + "\n"); process.exitCode = 1; });
}
