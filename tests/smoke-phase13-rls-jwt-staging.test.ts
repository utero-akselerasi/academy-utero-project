import { describe, expect, it, vi } from "vitest";
import { smokeJwtRlsStaging, validateJwtSmokeConfig } from "../scripts/smoke-phase13-rls-jwt-staging.mjs";

const jwt = (suffix: string, claims: Record<string, unknown> = {}, algorithm = "HS256") =>
  Buffer.from(JSON.stringify({ alg: algorithm, typ: "JWT" })).toString("base64url") + "." +
  Buffer.from(JSON.stringify({ sub: `00000000-0000-4000-8000-00000000000${suffix}`, role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600, ...claims })).toString("base64url") + "." + "s".repeat(32);
const env = { SUPABASE_STAGING_URL: "http://127.0.0.1:18100", SUPABASE_STAGING_ANON_KEY: "k".repeat(24),
  PHASE13_JWT_INTERN: jwt("1"), PHASE13_JWT_MENTOR: jwt("2"), PHASE13_JWT_SCHOOL: jwt("3"), PHASE13_JWT_ADMIN: jwt("4"), PHASE13_JWT_SUPER_ADMIN: jwt("5"),
  PHASE13_RLS_INTERN_PROFILE_ID: "00000000-0000-0000-0000-000000000001",
  PHASE13_RLS_OTHER_INTERN_PROFILE_ID: "00000000-0000-0000-0000-000000000002",
  PHASE13_RLS_SCHOOL_ID: "00000000-0000-0000-0000-000000000003",
  PHASE13_RLS_OTHER_SCHOOL_INTERN_ID: "00000000-0000-0000-0000-000000000004" };

describe("signed JWT RLS staging smoke", () => {
  it("menolak endpoint remote, token kosong, dan fixture ID tidak valid", () => {
    expect(() => validateJwtSmokeConfig({ ...env, SUPABASE_STAGING_URL: "https://supabase.carubra.space" })).toThrow();
    expect(() => validateJwtSmokeConfig({ ...env, PHASE13_JWT_ADMIN: "" })).toThrow();
    expect(() => validateJwtSmokeConfig({ ...env, PHASE13_JWT_ADMIN: env.PHASE13_JWT_INTERN })).toThrow();
    expect(() => validateJwtSmokeConfig({ ...env, PHASE13_JWT_ADMIN: jwt("1", { exp: Math.floor(Date.now() / 1000) + 7200 }) })).toThrow();
    expect(() => validateJwtSmokeConfig({ ...env, PHASE13_JWT_ADMIN: jwt("4", { exp: Math.floor(Date.now() / 1000) - 1 }) })).toThrow();
    expect(() => validateJwtSmokeConfig({ ...env, PHASE13_JWT_ADMIN: jwt("4", { role: "service_role" }) })).toThrow();
    expect(() => validateJwtSmokeConfig({ ...env, PHASE13_JWT_ADMIN: jwt("4", {}, "none") })).toThrow();
    expect(() => validateJwtSmokeConfig({ ...env, PHASE13_RLS_SCHOOL_ID: "school" })).toThrow();
  });

  it("menguji role dan isolasi tenant dengan request read-only", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      expect(options?.method).toBe("GET");
      const url = String(input);
      if (url.includes("user_profiles") && !new Headers(options?.headers).has("authorization")) return Response.json({ error: "denied" }, { status: 403 });
      if (url.includes("rpc/current_user_has_role")) return Response.json(true);
      if (url.includes("00000000-0000-0000-0000-000000000002") || url.includes("00000000-0000-0000-0000-000000000004")) return Response.json([]);
      return Response.json([{ id: "visible" }]);
    });
    const report = await smokeJwtRlsStaging(env, fetcher);
    expect(report.ready).toBe(true);
    expect(report.mode).toBe("signed-jwt-read-only");
    expect(JSON.stringify(report)).not.toContain(env.PHASE13_JWT_INTERN);
    expect(fetcher.mock.calls.every(([, options]) => options?.method === "GET")).toBe(true);
  });

  it("gagal bila cross-tenant terlihat", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      if (String(input).includes("user_profiles") && !new Headers(options?.headers).has("authorization")) return Response.json({}, { status: 403 });
      if (String(input).includes("rpc/current_user_has_role")) return Response.json(true);
      return Response.json([{ id: "visible" }]);
    });
    expect((await smokeJwtRlsStaging(env, fetcher)).ready).toBe(false);
  });
});
