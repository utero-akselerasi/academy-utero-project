import { describe, expect, it, vi } from "vitest";
import { validateBindingConfig, verifyAppBinding } from "../scripts/verify-phase13-staging-app-binding.mjs";

const env = { DEPLOY_TARGET: "staging", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:18100", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service", NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100/", PHASE13_STAGING_PROBE_TOKEN: "a".repeat(32) };

describe("verify staging app binding", () => {
  it("menolak production, develop, dan app non-loopback", () => {
    expect(() => validateBindingConfig({ ...env, DEPLOY_TARGET: "production" })).toThrow();
    expect(() => validateBindingConfig({ ...env, NEXT_PUBLIC_SUPABASE_URL: "https://supabase.carubra.com" })).toThrow();
    expect(() => validateBindingConfig({ ...env, NEXT_PUBLIC_APP_URL: "https://academy.example" })).toThrow();
    expect(() => validateBindingConfig({ ...env, NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000/" })).toThrow();
    expect(() => validateBindingConfig({ ...env, NEXT_PUBLIC_APP_URL: "http://user:pass@127.0.0.1:3100/" })).toThrow();
    expect(() => validateBindingConfig({ ...env, PHASE13_STAGING_PROBE_TOKEN: "weak" })).toThrow();
  });

  it("membuktikan marker staging pada bundle browser dengan GET saja", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      expect(options?.method).toBe("GET");
      if (String(input).endsWith("/register")) return new Response('<script src="/_next/app.js"></script>');
      if (String(input).endsWith("/_next/app.js")) return new Response('const url="http://127.0.0.1:18100"');
      expect(options?.headers).toEqual({ "x-phase13-probe-token": env.PHASE13_STAGING_PROBE_TOKEN });
      return Response.json({ deploymentTarget: "staging", supabaseOrigin: "http://127.0.0.1:18100",
        serverRuntimeBinding: "passed", authAdminProbe: "passed" });
    });
    await expect(verifyAppBinding(env, fetcher)).resolves.toEqual({ appHttp: "passed", browserSupabaseBinding: "passed",
      serverRuntimeBinding: "passed", bindingProven: true });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("gagal bila bundle masih memuat target develop", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith("/register")
      ? new Response('<script src="/_next/app.js"></script>')
      : new Response('http://127.0.0.1:18100 https://supabase.carubra.com'));
    await expect(verifyAppBinding(env, fetcher)).resolves.toMatchObject({ browserSupabaseBinding: "failed" });
  });

  it("tidak menganggap marker browser sebagai bukti server runtime", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith("/register")
      ? new Response('<script src="/_next/app.js"></script>')
      : new Response('http://127.0.0.1:18100'));
    const result = await verifyAppBinding(env, fetcher);
    expect(result.browserSupabaseBinding).toBe("passed");
    expect(result.bindingProven).toBe(false);
    expect(result.serverRuntimeBinding).toBe("failed");
  });
});
