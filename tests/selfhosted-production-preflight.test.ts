import { readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseProductionPreflightArgs, runProductionPreflight, writeProductionPreflightReport } from "../scripts/selfhosted-production-preflight.mjs";

const output = path.join(tmpdir(), "academy-production-preflight.json");
const args = ["--base-url", "https://academy.example.com", "--output", output];
const secureHeaders = { "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy": "default-src 'self'" };

function dependencies(overrides: Record<string, unknown> = {}) {
  const dates = [new Date("2026-10-15T10:00:00Z"), new Date("2026-10-15T10:00:01Z")];
  return {
    now: () => dates.shift() ?? new Date("2026-10-15T10:00:01Z"),
    tlsProbe: async () => ({ validFrom: "Oct 01 00:00:00 2026 GMT", validTo: "Dec 01 00:00:00 2026 GMT", fingerprint256: "AA:BB" }),
    fetch: async (url: URL, init: RequestInit) => {
      expect(init.method).toBe("GET");
      expect(init.redirect).toBe("manual");
      expect(init.credentials).toBe("omit");
      if (url.protocol === "http:") return new Response(null, { status: 308, headers: { location: "https://academy.example.com/" } });
      return new Response("ok", { status: 200, headers: secureHeaders });
    },
    ...overrides,
  };
}

describe("self-hosted production preflight", () => {
  it("menolak target lokal, URL tidak murni, dan output relatif", () => {
    expect(() => parseProductionPreflightArgs(["--base-url", "http://academy.example.com", "--output", output])).toThrow("HTTPS");
    expect(() => parseProductionPreflightArgs(["--base-url", "https://127.0.0.1", "--output", output])).toThrow("hostname production");
    expect(() => parseProductionPreflightArgs(["--base-url", "https://academy.example.com:8443", "--output", output])).toThrow("origin HTTPS");
    expect(() => parseProductionPreflightArgs(["--base-url", "https://academy.example.com/path", "--output", output])).toThrow("origin HTTPS");
    expect(() => parseProductionPreflightArgs(["--base-url", "https://academy.example.com", "--output", "report.json"])).toThrow("path absolut");
  });

  it("menghasilkan PASS production saat TLS, redirect, health, dan header valid", async () => {
    const config = parseProductionPreflightArgs(args);
    const report = await runProductionPreflight(config, dependencies());
    expect(report).toMatchObject({ gate: "tlsPreflight", target: "production", status: "PASS",
      checks: { tls: { ok: true, hostname: "academy.example.com" }, httpRedirect: { ok: true },
        health: { ok: true }, securityHeaders: { ok: true } } });
  });

  it("fail closed dan tetap menghasilkan evidence saat probe melempar error", async () => {
    const config = parseProductionPreflightArgs(args);
    const report = await runProductionPreflight(config, dependencies({
      tlsProbe: async () => { throw new Error("certificate expired"); },
      fetch: async () => { throw new Error("connection refused"); },
    }));
    expect(report.status).toBe("FAIL");
    expect(Object.values(report.checks).every((check) => check.ok === false)).toBe(true);
    expect(report.checks.tls.error).toBe("certificate expired");
  });

  it("gagal bila redirect lintas host, sertifikat terlalu dekat, atau security header kurang", async () => {
    const config = parseProductionPreflightArgs(args);
    const report = await runProductionPreflight(config, dependencies({
      tlsProbe: async () => ({ validFrom: "Oct 01 00:00:00 2026 GMT", validTo: "Oct 20 00:00:00 2026 GMT" }),
      fetch: async (url: URL) => url.protocol === "http:"
        ? new Response(null, { status: 302, headers: { location: "https://evil.example/" } })
        : new Response("ok", { status: 200, headers: { "x-content-type-options": "nosniff" } }),
    }));
    expect(report.status).toBe("FAIL");
    expect(report.checks.tls.ok).toBe(false);
    expect(report.checks.httpRedirect.ok).toBe(false);
    expect(report.checks.securityHeaders.ok).toBe(false);
  });

  it("menulis JSON atomik beserta metadata hash", async () => {
    const uniqueOutput = path.join(tmpdir(), `academy-production-preflight-${process.pid}-${Date.now()}.json`);
    const config = parseProductionPreflightArgs(["--base-url", "https://academy.example.com", "--output", uniqueOutput]);
    const report = await runProductionPreflight(config, dependencies());
    const evidence = await writeProductionPreflightReport(report, uniqueOutput);
    expect(evidence.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect((await stat(uniqueOutput)).size).toBe(evidence.sizeBytes);
    expect(JSON.parse(await readFile(uniqueOutput, "utf8"))).toMatchObject({ target: "production", status: "PASS" });
  });
});
