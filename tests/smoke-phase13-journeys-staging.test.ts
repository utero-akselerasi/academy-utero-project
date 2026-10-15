import { describe, expect, it, vi } from "vitest";
import { smokeComplete, smokeJourneys, validateStaging } from "../scripts/smoke-phase13-journeys-staging.mjs";

const env = { PHASE13_STAGING_APP_URL: "http://127.0.0.1:3101/", SUPABASE_STAGING_URL: "http://127.0.0.1:18100", PHASE13_SOUNDPUB_AVATAR_PATH: "sample/avatar.png" };

describe("smoke phase13 journeys staging", () => {
  it("menolak target remote, port service, dan path traversal", () => {
    expect(() => validateStaging({ ...env, PHASE13_STAGING_APP_URL: "https://supabase.carubra.space/" })).toThrow();
    expect(() => validateStaging({ ...env, PHASE13_STAGING_APP_URL: "http://127.0.0.1:18100/" })).toThrow();
    expect(() => validateStaging({ ...env, PHASE13_STAGING_APP_URL: "http://127.0.0.1:3000/" })).toThrow();
    expect(() => validateStaging({ ...env, PHASE13_SOUNDPUB_AVATAR_PATH: "../secret" })).toThrow();
  });

  it("menguji halaman publik dan sampel avatar tanpa auth atau write", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _options?: RequestInit) => new Response("image", { status: 200, headers: { "content-type": "image/png" } }));
    const result = await smokeJourneys(env, fetcher);
    expect(result).toEqual({ "/register": "passed", "/login": "passed", soundpubAvatar: "passed" });
    expect(smokeComplete(result)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls.every(([, options]) => options?.method === "GET" && options.redirect === "manual")).toBe(true);
  });

  it("melaporkan sampel kosong sebagai untested dan redirect sebagai failed", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 302 }));
    expect(await smokeJourneys({ ...env, PHASE13_SOUNDPUB_AVATAR_PATH: "" }, fetcher)).toEqual({ "/register": "failed", "/login": "failed", soundpubAvatar: "untested" });
    expect(smokeComplete({ "/register": "passed", "/login": "passed", soundpubAvatar: "untested" })).toBe(false);
    expect(smokeComplete({ "/register": "passed", "/login": "passed" })).toBe(false);
  });
});
