import { describe, expect, it } from "vitest";
import { parseReadonlyLoadArgs, runReadonlyLoad } from "../scripts/selfhosted-readonly-load.mjs";

describe("self-hosted readonly load", () => {
  it("menolak target production non-HTTPS dan batas berlebihan", () => {
    expect(() => parseReadonlyLoadArgs(["--base-url", "http://academy.example.com"])).toThrow("HTTPS");
    expect(() => parseReadonlyLoadArgs(["--base-url", "https://academy.example.com", "--requests", "501"])).toThrow("1-500");
    expect(() => parseReadonlyLoadArgs(["--base-url", "https://academy.example.com", "--paths", "/api/health?write=true"])).toThrow("path absolut aman");
  });

  it("hanya mengirim GET tanpa kredensial dan menghasilkan PASS", async () => {
    const config = parseReadonlyLoadArgs(["--base-url", "https://academy.example.com", "--requests", "4", "--concurrency", "2"]);
    expect(config.target).toBe("production");
    const calls: Array<[string, RequestInit]> = [];
    let tick = 0;
    const report = await runReadonlyLoad(config, {
      clock: () => tick += 10,
      now: () => new Date("2026-10-15T10:00:00Z"),
      fetch: async (url: URL, options: RequestInit) => {
        calls.push([String(url), options]);
        return new Response("ok", { status: 200 });
      },
    });
    expect(report.status).toBe("PASS");
    expect(report.result.completed).toBe(4);
    expect(calls.every(([, options]) => options.method === "GET" && !(options.headers as Record<string, string>).authorization)).toBe(true);
  });

  it("gagal bila satu path selalu gagal walau error rate budget longgar", async () => {
    const config = parseReadonlyLoadArgs(["--base-url", "http://127.0.0.1:19982", "--paths", "/api/health,/login",
      "--requests", "4", "--max-error-rate", "1"]);
    expect(config.target).toBe("local");
    const report = await runReadonlyLoad(config, { fetch: async (url: URL) => new Response("x", { status: url.pathname === "/login" ? 500 : 200 }) });
    expect(report.target).toBe("local");
    expect(report.status).toBe("FAIL");
  });
});
