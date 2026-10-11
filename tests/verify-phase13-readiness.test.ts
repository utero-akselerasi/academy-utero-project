import { describe, expect, it, vi } from "vitest";

const modulePath = "../scripts/verify-phase13-readiness.mjs";
const { checkReadiness, validateConfig, repositoryMigrationVersions, REQUIRED_BUCKETS } = await import(modulePath) as {
  checkReadiness: (target: string, config: Record<string, string>, deps: { fetcher: typeof fetch; queryMigrationVersions: (url: string) => Promise<string[]>; expectedVersions?: string[] }) => Promise<{ ready: boolean; missingVersions: string[]; unexpectedVersions: string[]; missingBuckets: string[]; latestVersion: string | null; expectedLatestVersion: string }>;
  validateConfig: (target: string, config: Record<string, string>) => unknown;
  repositoryMigrationVersions: (filenames: string[]) => string[];
  REQUIRED_BUCKETS: string[];
};

const config = { endpoint: "https://supabase.carubra.com", databaseUrl: "postgres://operator:password@20.20.20.173:5432/postgres", serviceKey: "test-key" };
const response = (body: unknown) => ({ ok: true, json: async () => body });
const expectedVersions = ["0038", "0039", "0040"];

describe("phase13 readiness", () => {
  it("menolak target salah sebelum panggilan jaringan", async () => {
    const fetcher = vi.fn();
    const queryMigrationVersions = vi.fn();
    await expect(checkReadiness("production", config, { fetcher, queryMigrationVersions, expectedVersions })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    expect(queryMigrationVersions).not.toHaveBeenCalled();
  });

  it("menolak host database salah atau endpoint dengan path", () => {
    expect(() => validateConfig("develop", { ...config, databaseUrl: config.databaseUrl.replace("20.20.20.173", "20.20.20.3") })).toThrow();
    expect(() => validateConfig("develop", { ...config, endpoint: `${config.endpoint}/bad` })).toThrow();
  });

  it("hanya memakai GET dan melaporkan siap jika seluruh cek lulus", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({})).mockResolvedValueOnce(response(REQUIRED_BUCKETS.map((id) => ({ id }))));
    const queryMigrationVersions = vi.fn().mockResolvedValue(expectedVersions);
    const result = await checkReadiness("develop", config, { fetcher, queryMigrationVersions, expectedVersions });
    expect(result.ready).toBe(true);
    expect(result.expectedLatestVersion).toBe("0040");
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [, options] of fetcher.mock.calls) expect(options.method).toBe("GET");
    expect(queryMigrationVersions).toHaveBeenCalledWith(config.databaseUrl);
  });

  it("gagal tertutup saat bucket hilang dan versi lama", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({})).mockResolvedValueOnce(response([{ id: "avatars" }]));
    const result = await checkReadiness("develop", config, { fetcher, queryMigrationVersions: async () => ["0038"], expectedVersions });
    expect(result.ready).toBe(false);
    expect(result.missingVersions).toEqual(["0039", "0040"]);
    expect(result.missingBuckets).toContain("daily-report");
    expect(result.missingBuckets).toContain("academy-private");
  });

  it("gagal jika endpoint tidak sehat", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(checkReadiness("develop", config, { fetcher, queryMigrationVersions: vi.fn(), expectedVersions })).rejects.toThrow("HTTP 503");
  });

  it("mengikuti 0041 ketika berkas migrasi ditambahkan, tanpa menyatakan SQL sudah terpasang", async () => {
    const repo = repositoryMigrationVersions(["0039_initial.sql", "0040_hardening.sql", "0041_new.sql", "README.md"]);
    expect(repo).toEqual(["0039", "0040", "0041"]);
    const fetcher = vi.fn().mockResolvedValueOnce(response({})).mockResolvedValueOnce(response(REQUIRED_BUCKETS.map((id) => ({ id }))));
    const result = await checkReadiness("develop", config, { fetcher, queryMigrationVersions: async () => ["0039", "0040"], expectedVersions: repo });
    expect(result).toMatchObject({ ready: false, expectedLatestVersion: "0041", latestVersion: "0040", missingVersions: ["0041"] });
  });
});
