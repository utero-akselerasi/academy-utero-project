#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const targets = Object.freeze([
  { host: "20.20.20.173", gateway: "supabase-kong", gatewayKeys: ["SUPABASE_ANON_KEY", "SUPABASE_SERVICE_KEY"] },
  { host: "20.20.20.3", gateway: "supabase-envoy", gatewayKeys: ["ANON_KEY", "SERVICE_ROLE_KEY"] },
]);

function requirements(target) {
  return [
    ["supabase-db", "JWT_SECRET", "jwt"],
    ["supabase-auth", "GOTRUE_JWT_SECRET", "jwt"],
    ["supabase-rest", "PGRST_APP_SETTINGS_JWT_SECRET", "jwt"],
    ["supabase-edge-functions", "JWT_SECRET", "jwt"],
    ["supabase-edge-functions", "SUPABASE_ANON_KEY", "anon"],
    ["supabase-edge-functions", "SUPABASE_SERVICE_ROLE_KEY", "service"],
    ["supabase-storage", "ANON_KEY", "anon"],
    ["supabase-storage", "AUTH_JWT_SECRET", "jwt"],
    ["supabase-studio", "SUPABASE_ANON_KEY", "anon"],
    ["supabase-studio", "SUPABASE_SERVICE_KEY", "service"],
    ["supabase-studio", "AUTH_JWT_SECRET", "jwt"],
    ["supabase-studio", "SUPABASE_PUBLISHABLE_KEY", "publishable"],
    ["supabase-studio", "SUPABASE_SECRET_KEY", "secretKey"],
    ["realtime-dev.supabase-realtime", "API_JWT_SECRET", "jwt"],
    ["realtime-dev.supabase-realtime", "METRICS_JWT_SECRET", "metrics"],
    ["supabase-pooler", "API_JWT_SECRET", "jwt"],
    ["supabase-pooler", "METRICS_JWT_SECRET", "metrics"],
    [target.gateway, target.gatewayKeys[0], "anon"],
    [target.gateway, target.gatewayKeys[1], "service"],
    [target.gateway, "SUPABASE_PUBLISHABLE_KEY", "publishable"],
    [target.gateway, "SUPABASE_SECRET_KEY", "secretKey"],
    [target.gateway, "ANON_KEY_ASYMMETRIC", "anonAsymmetric"],
    [target.gateway, "SERVICE_ROLE_KEY_ASYMMETRIC", "serviceAsymmetric"],
  ];
}

function credentialsFor(containers, target) {
  if (!Array.isArray(containers)) return null;
  const values = { jwt: new Set(), anon: new Set(), service: new Set(), metrics: new Set(),
    publishable: new Set(), secretKey: new Set(), anonAsymmetric: new Set(), serviceAsymmetric: new Set() };
  for (const [name, key, group] of requirements(target)) {
    const matches = containers.filter((container) => container?.Name === `/${name}` &&
      container?.State?.Running === true && container?.Config?.Labels?.["com.docker.compose.project"] === "supabase");
    if (matches.length !== 1 || !Array.isArray(matches[0].Config.Env)) return null;
    const entries = matches[0].Config.Env.filter((entry) => typeof entry === "string" && entry.startsWith(`${key}=`));
    if (entries.length !== 1 || entries[0].length === key.length + 1) return null;
    values[group].add(entries[0].slice(key.length + 1));
  }
  if (!Object.values(values).every((items) => items.size === 1)) return null;
  const result = Object.fromEntries(Object.entries(values).map(([name, items]) => [name, [...items][0]]));
  const rest = containers.find((container) => container?.Name === "/supabase-rest" &&
    container?.State?.Running === true && container?.Config?.Labels?.["com.docker.compose.project"] === "supabase");
  const rawJwks = rest?.Config?.Env?.find((entry) => entry.startsWith("PGRST_JWT_SECRET="))
    ?.slice("PGRST_JWT_SECRET=".length);
  try {
    const jwks = JSON.parse(rawJwks);
    const expected = Buffer.from(result.jwt, "utf8").toString("base64url");
    if (!Array.isArray(jwks?.keys) || !jwks.keys.some((key) =>
      key?.kty === "oct" && key?.alg === "HS256" && key?.k === expected)) return null;
    const ecKeys = jwks.keys.filter((key) => key?.kty === "EC" && key?.alg === "ES256");
    if (ecKeys.some((key) => !key.crv || !key.x || !key.y)) return null;
    result.ecPublic = ecKeys.map(({ crv, x, y }) => JSON.stringify({ crv, x, y })).sort().join("|");
    const functions = containers.find((container) => container?.Name === "/supabase-edge-functions" &&
      container?.State?.Running === true && container?.Config?.Labels?.["com.docker.compose.project"] === "supabase");
    const functionEnv = (key) => functions?.Config?.Env?.find((entry) => entry.startsWith(`${key}=`))
      ?.slice(key.length + 1);
    if (JSON.parse(functionEnv("SUPABASE_PUBLISHABLE_KEYS"))?.default !== result.publishable ||
        JSON.parse(functionEnv("SUPABASE_SECRET_KEYS"))?.default !== result.secretKey) return null;
  } catch { return null; }
  return result;
}

export function verifyRuntimeCredentials(develop, production) {
  const dev = credentialsFor(develop, targets[0]);
  const prod = credentialsFor(production, targets[1]);
  return Boolean(dev && prod && Object.keys(dev).every((group) =>
    group === "ecPublic" && !dev[group] && !prod[group] ? true : dev[group] !== prod[group]));
}

function inspect(target) {
  const names = [...new Set(requirements(target).map(([name]) => name))];
  const result = spawnSync("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=12",
    "-o", "StrictHostKeyChecking=yes", `maskhar@${target.host}`, `docker inspect ${names.join(" ")}`],
  { encoding: "utf8", maxBuffer: 4 * 1024 * 1024, windowsHide: true });
  if (result.status !== 0 || result.error) return null;
  try { return JSON.parse(result.stdout); } catch { return null; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ready = verifyRuntimeCredentials(inspect(targets[0]), inspect(targets[1]));
  process.stdout.write(ready ? "GO\n" : "NO-GO\n");
  if (!ready) process.exitCode = 1;
}
