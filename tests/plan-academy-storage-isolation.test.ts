import { execFile } from "node:child_process";
import { mkdtemp, readFile, stat, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

// @ts-expect-error JavaScript operational script intentionally has no declaration file.
const { buildPlan, normalizeAvatarPath, parseOptions, planIsolation, writePlan } = await import("../scripts/plan-academy-storage-isolation.mjs");

function mockQuery(references: string[], production: Record<string, unknown>[], develop: Record<string, unknown>[]) {
  return async (source: string, sql: string) => sql.includes("storage.objects")
    ? source === "production" ? production : develop
    : references.map((value) => ({ value }));
}

const entry = (name: string, size = 1, eTag = "same") => ({ name, metadata: { size, eTag } });

describe("planner isolasi Storage Academy", () => {
  it("menormalisasi URL legacy dan path tanpa membuka token", () => {
    expect(normalizeAvatarPath("https://example.invalid/storage/v1/object/sign/avatars/user/a%20b.jpg?token=secret"))
      .toBe("user/a b.jpg");
    expect(normalizeAvatarPath("/user/a.jpg")).toBe("user/a.jpg");
    expect(() => normalizeAvatarPath("https://example.invalid/storage/v1/object/public/other/a.jpg")).toThrow();
    expect(() => normalizeAvatarPath("user/../a.jpg")).toThrow();
  });

  it("membagi production lebih dulu dan develop hanya sisa", async () => {
    const plan = await buildPlan(mockQuery(["a.jpg", "b.jpg", "a.jpg"], [entry("a.jpg")], [entry("a.jpg"), entry("b.jpg")]));
    expect(plan.production).toEqual(["a.jpg"]);
    expect(plan.develop).toEqual(["b.jpg"]);
    expect(plan.summary.total).toBe(2);
    expect(plan.summary.productionDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("gagal tertutup untuk objek hilang, overlap beda, dan metadata kosong", async () => {
    await expect(buildPlan(mockQuery(["missing"], [], []))).rejects.toThrow();
    await expect(buildPlan(mockQuery(["a"], [entry("a")], [entry("a", 2)]))).rejects.toThrow();
    await expect(buildPlan(mockQuery(["a"], [entry("a", 1, "other")], [entry("a")]))).rejects.toThrow();
    await expect(buildPlan(mockQuery(["a"], [{ name: "a", metadata: {} }], []))).rejects.toThrow();
  });

  it("menolak env invalid dan output dalam repo", () => {
    const args = ["--reconciled-url-env", "RECONCILED", "--develop-url-env", "DEVELOP",
      "--production-url-env", "PRODUCTION", "--output-dir", path.join(process.cwd(), "private")];
    expect(() => parseOptions(args)).toThrow();
    expect(() => parseOptions([...args.slice(0, -1), "relative"])).toThrow();
  });

  it("menolak symlink dan menulis file privat secara eksklusif", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "academy-plan-"));
    const plan = await buildPlan(mockQuery(["a"], [entry("a")], []));
    await writePlan(root, plan);
    expect(await readFile(path.join(root, "production-paths.txt"), "utf8")).toBe("a\n");
    if (process.platform === "win32") {
      for (const target of [root, path.join(root, "production-paths.txt")]) {
        const { stdout } = await promisify(execFile)("icacls.exe", [target]);
        expect(stdout).not.toContain("(I)");
        expect(stdout).not.toMatch(/Authenticated Users|BUILTIN\\Users/i);
      }
    } else {
      expect((await stat(path.join(root, "production-paths.txt"))).mode & 0o077).toBe(0);
    }
    await expect(writePlan(root, plan)).rejects.toThrow();
    const link = path.join(root, "link");
    await symlink(root, link, process.platform === "win32" ? "junction" : "dir");
    await expect(writePlan(link, plan)).rejects.toThrow();
  });

  it("injeksi query menggunakan URL env tanpa membocorkannya di ringkasan", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "academy-plan-"));
    const options = parseOptions(["--reconciled-url-env", "R", "--develop-url-env", "D",
      "--production-url-env", "P", "--output-dir", root]);
    const seen: string[] = [];
    const summary = await planIsolation(options, {
      env: { R: "postgres://secret@reconciled.invalid/db", D: "postgres://secret@develop.invalid/db",
        P: "postgres://secret@production.invalid/db" },
      query: async (url: string, sql: string) => {
        seen.push(url);
        return sql.includes("storage.objects") ? [entry("a")] : [{ value: "a" }];
      },
    });
    expect(seen).toHaveLength(11);
    expect(JSON.stringify(summary)).not.toContain("secret");
  });
});
