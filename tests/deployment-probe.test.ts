import { describe, expect, it, vi } from "vitest";
import { probeStagingDeployment } from "../lib/deployment-probe";

const token = "p".repeat(32);
const env = { DEPLOY_TARGET: "staging", PHASE13_STAGING_PROBE_TOKEN: token,
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:18100", SUPABASE_SERVICE_ROLE_KEY: "service-key" };

function request(value = token) {
  return new Request("http://127.0.0.1:3100/api/internal/deployment-probe", {
    headers: { "x-phase13-probe-token": value },
  });
}

describe("staging deployment probe", () => {
  it("tidak tersedia di luar staging", async () => {
    expect((await probeStagingDeployment(request(), { ...env, DEPLOY_TARGET: "production" })).status).toBe(404);
  });

  it("menolak token hilang, pendek, atau salah", async () => {
    expect((await probeStagingDeployment(new Request(request().url), env)).status).toBe(401);
    expect((await probeStagingDeployment(request("salah"), env)).status).toBe(401);
    expect((await probeStagingDeployment(request(), { ...env, PHASE13_STAGING_PROBE_TOKEN: "pendek" })).status).toBe(401);
  });

  it("membuktikan binding server dan service key tanpa mengembalikan secret", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, options?: RequestInit) => {
      expect(options?.headers).toEqual({ apikey: "service-key", Authorization: "Bearer service-key" });
      return Response.json({ users: [], total: 0 });
    });
    const response = await probeStagingDeployment(request(), env, fetcher);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const payload = await response.json();
    expect(payload).toEqual({ deploymentTarget: "staging", supabaseOrigin: "http://127.0.0.1:18100",
      serverRuntimeBinding: "passed", authAdminProbe: "passed" });
    expect(JSON.stringify(payload)).not.toContain("service-key");
  });

  it("gagal tertutup saat target, jaringan, atau key salah", async () => {
    expect((await probeStagingDeployment(request(), { ...env, NEXT_PUBLIC_SUPABASE_URL: "https://supabase.carubra.com" })).status).toBe(503);
    expect((await probeStagingDeployment(request(), env, vi.fn(async () => new Response(null, { status: 401 })))).status).toBe(503);
    expect((await probeStagingDeployment(request(), env, vi.fn(async () => new Response("login page")))).status).toBe(503);
    expect((await probeStagingDeployment(request(), env, vi.fn(async () => { throw new Error("offline"); }))).status).toBe(503);
  });
});
