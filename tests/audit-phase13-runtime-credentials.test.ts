import { describe, expect, it } from "vitest";

const modulePath = "../scripts/audit-phase13-runtime-credentials.mjs";
const { verifyRuntimeCredentials } = await import(modulePath) as {
  verifyRuntimeCredentials(develop: unknown, production: unknown): boolean;
};

function container(name: string, env: Record<string, string>) {
  return {
    Name: `/${name}`, State: { Running: true },
    Config: { Labels: { "com.docker.compose.project": "supabase" },
      Env: Object.entries(env).map(([key, value]) => `${key}=${value}`) },
  };
}

function snapshot(gateway: "supabase-kong" | "supabase-envoy", jwt: string, anon: string, service: string, metrics = `${jwt}-metrics`, modern = jwt) {
  const jwks = JSON.stringify({ keys: [{ kty: "oct", alg: "HS256", k: Buffer.from(jwt).toString("base64url") }] });
  const publishable = `${modern}-publishable`;
  const secretKey = `${modern}-secret-key`;
  return [
    container("supabase-db", { JWT_SECRET: jwt }),
    container("supabase-auth", { GOTRUE_JWT_SECRET: jwt }),
    container("supabase-rest", { PGRST_JWT_SECRET: jwks, PGRST_APP_SETTINGS_JWT_SECRET: jwt }),
    container("supabase-edge-functions", { JWT_SECRET: jwt, SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service,
      SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: publishable }),
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: secretKey }) }),
    container("supabase-storage", { ANON_KEY: anon, AUTH_JWT_SECRET: jwt }),
    container("supabase-studio", { SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_KEY: service, AUTH_JWT_SECRET: jwt,
      SUPABASE_PUBLISHABLE_KEY: publishable, SUPABASE_SECRET_KEY: secretKey }),
    container("realtime-dev.supabase-realtime", { API_JWT_SECRET: jwt, METRICS_JWT_SECRET: metrics }),
    container("supabase-pooler", { API_JWT_SECRET: jwt, METRICS_JWT_SECRET: metrics }),
    container(gateway, gateway === "supabase-kong"
      ? { SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_KEY: service, SUPABASE_PUBLISHABLE_KEY: publishable,
        SUPABASE_SECRET_KEY: secretKey, ANON_KEY_ASYMMETRIC: `${modern}-anon-asym`,
        SERVICE_ROLE_KEY_ASYMMETRIC: `${modern}-service-asym` }
      : { ANON_KEY: anon, SERVICE_ROLE_KEY: service, SUPABASE_PUBLISHABLE_KEY: publishable,
        SUPABASE_SECRET_KEY: secretKey, ANON_KEY_ASYMMETRIC: `${modern}-anon-asym`,
        SERVICE_ROLE_KEY_ASYMMETRIC: `${modern}-service-asym` }),
  ];
}

describe("phase 13 runtime credential audit", () => {
  it("accepts internally consistent and cross-host isolated credentials", () => {
    expect(verifyRuntimeCredentials(
      snapshot("supabase-kong", "dev-jwt", "dev-anon", "dev-service"),
      snapshot("supabase-envoy", "prod-jwt", "prod-anon", "prod-service"),
    )).toBe(true);
  });

  it.each([
    ["JWT", ["shared", "dev-anon", "dev-service"], ["shared", "prod-anon", "prod-service"]],
    ["anon", ["dev-jwt", "shared", "dev-service"], ["prod-jwt", "shared", "prod-service"]],
    ["service", ["dev-jwt", "dev-anon", "shared"], ["prod-jwt", "prod-anon", "shared"]],
  ])("rejects shared %s material", (_name, dev, prod) => {
    expect(verifyRuntimeCredentials(
      snapshot("supabase-kong", ...dev as [string, string, string]),
      snapshot("supabase-envoy", ...prod as [string, string, string]),
    )).toBe(false);
  });

  it("fails closed when a component is absent", () => {
    const develop = snapshot("supabase-kong", "dev-jwt", "dev-anon", "dev-service");
    develop.pop();
    expect(verifyRuntimeCredentials(develop,
      snapshot("supabase-envoy", "prod-jwt", "prod-anon", "prod-service"))).toBe(false);
  });

  it("fails closed when credentials disagree inside one host", () => {
    const develop = snapshot("supabase-kong", "dev-jwt", "dev-anon", "dev-service");
    develop[1].Config.Env = ["GOTRUE_JWT_SECRET=wrong-jwt"];
    expect(verifyRuntimeCredentials(develop,
      snapshot("supabase-envoy", "prod-jwt", "prod-anon", "prod-service"))).toBe(false);
  });

  it("rejects shared metrics credentials", () => {
    expect(verifyRuntimeCredentials(
      snapshot("supabase-kong", "dev-jwt", "dev-anon", "dev-service", "shared-metrics"),
      snapshot("supabase-envoy", "prod-jwt", "prod-anon", "prod-service", "shared-metrics"),
    )).toBe(false);
  });

  it("rejects PostgREST JWKS that does not contain the host HS256 key", () => {
    const develop = snapshot("supabase-kong", "dev-jwt", "dev-anon", "dev-service");
    develop[2].Config.Env = [
      `PGRST_JWT_SECRET=${JSON.stringify({ keys: [{ kty: "oct", alg: "HS256", k: "wrong" }] })}`,
      "PGRST_APP_SETTINGS_JWT_SECRET=dev-jwt",
    ];
    expect(verifyRuntimeCredentials(develop,
      snapshot("supabase-envoy", "prod-jwt", "prod-anon", "prod-service"))).toBe(false);
  });

  it("rejects shared modern publishable, secret, and asymmetric keys", () => {
    expect(verifyRuntimeCredentials(
      snapshot("supabase-kong", "dev-jwt", "dev-anon", "dev-service", "dev-metrics", "shared-modern"),
      snapshot("supabase-envoy", "prod-jwt", "prod-anon", "prod-service", "prod-metrics", "shared-modern"),
    )).toBe(false);
  });
});
