import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

const modulePath = "../scripts/smoke-phase13-storage-staging.mjs";
const { objectPath, smokeStaging, validateConfig } = await import(modulePath);

const env = {
  PHASE13_RECONCILED_DATABASE_URL: "postgresql://reader:db-secret@localhost:5432/phase13_reconciled_prod_20261012",
  SUPABASE_STAGING_URL: "http://127.0.0.1:18100",
  SUPABASE_STAGING_SERVICE_ROLE_KEY: "service-secret",
  SUPABASE_STAGING_ANON_KEY: "anon-secret",
};

function storageMock(missing = new Set<string>()) {
  const content = Buffer.from("verified-object");
  return vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = decodeURIComponent(url.pathname);
    if (path.includes("/object/public/")) return new Response("denied", { status: 400 });
    if (init?.headers && JSON.stringify(init.headers).includes(env.SUPABASE_STAGING_ANON_KEY)) {
      return new Response("denied", { status: 400 });
    }
    if (path.includes("/object/sign/") && init?.method === "POST") {
      return new Response(JSON.stringify({ signedURL: `${path}?token=signed-token` }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    }
    const objectName = path.split(/\/academy-private\/|\/daily-report\//).at(-1) ?? "";
    if (missing.has(objectName)) return new Response("missing", { status: 404 });
    return new Response(content, { status: 200, headers: { "content-length": String(content.length) } });
  });
}

describe("smoke-phase13-storage-staging", () => {
  it("mengunci clone dan endpoint staging localhost", () => {
    expect(validateConfig(env)).toMatchObject({ base: "http://127.0.0.1:18100" });
    expect(() => validateConfig({ ...env, PHASE13_RECONCILED_DATABASE_URL: env.PHASE13_RECONCILED_DATABASE_URL.replace("localhost", "20.20.20.3") })).toThrow("clone lokal");
    expect(() => validateConfig({ ...env, SUPABASE_STAGING_URL: "https://supabase.carubra.space" })).toThrow("tunnel staging");
  });

  it("menormalkan object path lama dan menolak path tidak aman", () => {
    expect(objectPath("https://old/storage/v1/object/public/avatars/user/a.jpg", "academy-private")).toBe("user/a.jpg");
    expect(objectPath("/user/a.jpg", "academy-private")).toBe("user/a.jpg");
    expect(objectPath("../secret", "academy-private")).toBeNull();
    expect(objectPath("https://old/storage/v1/object/public/wrong/a.jpg", "academy-private")).toBeNull();
  });

  it("menguji semua kategori, hash signed/direct, dan denial tanpa write", async () => {
    const query = vi.fn(async (sql: string) => [{ value: sql.includes("daily_report_attachments") ? "reports/evidence.jpg" : "academy/sample.jpg" }]);
    const fetchMock = storageMock();
    const result = await smokeStaging({ env, query, fetch: fetchMock });
    expect(Object.keys(result)).toHaveLength(10);
    expect(new Set(Object.values(result))).toEqual(new Set(["passed"]));
    expect(query).toHaveBeenCalledTimes(10);
    expect(query.mock.calls.every(([sql]) => sql.startsWith("select "))).toBe(true);
    expect(query.mock.calls.at(-1)?.[0]).toContain("mime_type <> 'url'");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/object/public/"))).toBe(true);
    expect(fetchMock.mock.calls.some(([, init]) => (JSON.stringify(init?.headers) ?? "").includes(env.SUPABASE_STAGING_ANON_KEY))).toBe(true);
    const methods = fetchMock.mock.calls.map(([, init]) => init?.method ?? "GET");
    expect(new Set(methods)).toEqual(new Set(["GET", "POST"]));
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST").every(([url]) => String(url).includes("/object/sign/"))).toBe(true);
  });

  it("melaporkan passed, missing, dan failed secara jujur", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("portfolio_path")) return [];
      if (sql.includes("certificate_template_path")) throw new Error("column unavailable");
      return [{ value: "academy/sample.jpg" }];
    });
    const result = await smokeStaging({ env, query, fetch: storageMock() });
    expect(result.portfolio).toBe("missing");
    expect(result.certificate_template).toBe("failed");
    expect(result.avatar).toBe("passed");
  });

  it("gagal jika signed bytes berbeda dan tidak membocorkan key atau path", async () => {
    const query = vi.fn(async () => [{ value: "private/sensitive-person.jpg" }]);
    const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname.includes("/public/") || JSON.stringify(init?.headers).includes(env.SUPABASE_STAGING_ANON_KEY)) {
        return new Response(null, { status: 403 });
      }
      if (init?.method === "POST") return new Response(JSON.stringify({ signedURL: `${url.pathname}?token=x` }));
      const signed = url.searchParams.has("token");
      return new Response(signed ? "changed" : "original");
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await smokeStaging({ env, query, fetch: fetchMock });
    expect(new Set(Object.values(result))).toEqual(new Set(["failed"]));
    expect(error).not.toHaveBeenCalled();
    const serializedResult = JSON.stringify(result);
    expect(serializedResult).not.toContain(env.SUPABASE_STAGING_SERVICE_ROLE_KEY);
    expect(serializedResult).not.toContain("sensitive-person");
    expect(createHash("sha256").update(serializedResult).digest("hex")).toHaveLength(64);
    error.mockRestore();
  });

  it("menolak error server sebagai bukti akses ditolak dan signed URL objek lain", async () => {
    const query = vi.fn(async () => [{ value: "academy/sample.jpg" }]);
    const serverError = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      if (String(input).includes("/object/public/")) return new Response(null, { status: 503 });
      return storageMock()(input, init);
    });
    expect(new Set(Object.values(await smokeStaging({ env, query, fetch: serverError })))).toEqual(new Set(["failed"]));

    const wrongObject = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Response(JSON.stringify({ signedURL: "/storage/v1/object/sign/academy-private/other.jpg?token=x" }));
      }
      return storageMock()(input, init);
    });
    expect(new Set(Object.values(await smokeStaging({ env, query, fetch: wrongObject })))).toEqual(new Set(["failed"]));
  });
});
