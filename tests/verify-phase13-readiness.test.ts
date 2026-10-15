import { describe, expect, it, vi } from "vitest";

const modulePath = "../scripts/verify-phase13-readiness.mjs";
const { checkReadiness, validateConfig, repositoryMigrationVersions, REQUIRED_BUCKETS } = await import(modulePath) as {
  checkReadiness: (target: string, config: Record<string, string>, deps: { fetcher: typeof fetch; queryMigrationTracker: (url: string) => Promise<{ exists: boolean; versions: string[] }>; expectedVersions?: string[] }) => Promise<{ ready: boolean; migrationTrackerExists: boolean; authAdminReadable: boolean; missingVersions: string[]; unexpectedVersions: string[]; missingBuckets: string[]; latestVersion: string | null; expectedLatestVersion: string }>;
  validateConfig: (target: string, config: Record<string, string>) => unknown;
  repositoryMigrationVersions: (filenames: string[]) => string[];
  REQUIRED_BUCKETS: string[];
};

const config = { endpoint: "https://supabase.carubra.com", databaseUrl: "postgres://operator:password@20.20.20.173:5432/postgres", serviceKey: "test-key" };
const stagingConfig = { endpoint: "http://127.0.0.1:18100", databaseUrl: "postgres://operator:password@127.0.0.1:15532/postgres", serviceKey: "test-key" };
const response = (body: unknown) => ({ ok: true, json: async () => body });
const tracker = (versions: string[], exists = true) => ({ exists, versions });
const expectedVersions = ["0038", "0039", "0040"];

describe("phase13 readiness", () => {
  it("menolak target salah sebelum panggilan jaringan", async () => {
    const fetcher = vi.fn();
    const queryMigrationTracker = vi.fn();
    await expect(checkReadiness("production", config, { fetcher, queryMigrationTracker, expectedVersions })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    expect(queryMigrationTracker).not.toHaveBeenCalled();
  });

  it("menolak host database salah atau endpoint dengan path", () => {
    expect(() => validateConfig("develop", { ...config, databaseUrl: config.databaseUrl.replace("20.20.20.173", "20.20.20.3") })).toThrow();
    expect(() => validateConfig("develop", { ...config, endpoint: `${config.endpoint}/bad` })).toThrow();
  });

  it("menerima staging lokal yang dikunci ke endpoint dan database tertentu", () => {
    expect(validateConfig("staging", stagingConfig)).toMatchObject({ endpoint: stagingConfig.endpoint, databaseHost: "127.0.0.1" });
  });

  it.each([
    { ...stagingConfig, endpoint: "http://localhost:18100" },
    { ...stagingConfig, endpoint: "http://127.0.0.1:18101" },
    { ...stagingConfig, databaseUrl: "postgres://operator:password@localhost:15532/postgres" },
    { ...stagingConfig, databaseUrl: "postgres://operator:password@127.0.0.1:5432/postgres" },
    { ...stagingConfig, databaseUrl: "postgres://operator:password@127.0.0.1:15532/academy" },
  ])("menolak konfigurasi staging di luar localhost yang ditentukan", (invalidConfig) => {
    expect(() => validateConfig("staging", invalidConfig)).toThrow();
  });

  it("hanya memakai GET dan melaporkan siap jika seluruh cek lulus", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ users: [] })).mockResolvedValueOnce(response(REQUIRED_BUCKETS.map((id) => ({ id }))));
    const queryMigrationTracker = vi.fn().mockResolvedValue(tracker(expectedVersions));
    const result = await checkReadiness("develop", config, { fetcher, queryMigrationTracker, expectedVersions });
    expect(result.ready).toBe(true);
    expect(result.authAdminReadable).toBe(true);
    expect(result.migrationTrackerExists).toBe(true);
    expect(result.expectedLatestVersion).toBe("0040");
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [, options] of fetcher.mock.calls) expect(options.method).toBe("GET");
    expect(fetcher.mock.calls[0][0]).toContain("/auth/v1/admin/users?page=1&per_page=1");
    expect(queryMigrationTracker).toHaveBeenCalledWith(config.databaseUrl);
  });

  it("gagal tertutup saat bucket hilang dan versi lama", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ users: [] })).mockResolvedValueOnce(response([{ id: "avatars" }]));
    const result = await checkReadiness("develop", config, { fetcher, queryMigrationTracker: async () => tracker(["0038"]), expectedVersions });
    expect(result.ready).toBe(false);
    expect(result.missingVersions).toEqual(["0039", "0040"]);
    expect(result.missingBuckets).toContain("daily-report");
    expect(result.missingBuckets).toContain("academy-private");
  });

  it("gagal jika endpoint tidak sehat", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(checkReadiness("develop", config, { fetcher, queryMigrationTracker: vi.fn(), expectedVersions })).rejects.toThrow("HTTP 503");
  });

  it("gagal tertutup jika Auth settings sehat tetapi Auth Admin tidak terbukti", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ external: {} })).mockResolvedValueOnce(response(REQUIRED_BUCKETS.map((id) => ({ id }))));
    await expect(checkReadiness("develop", config, { fetcher, queryMigrationTracker: async () => tracker(expectedVersions), expectedVersions })).rejects.toThrow("Respons Auth Admin tidak valid");
  });

  it("melaporkan tracker tidak ada tanpa membuat baseline palsu", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ users: [] })).mockResolvedValueOnce(response(REQUIRED_BUCKETS.map((id) => ({ id }))));
    const result = await checkReadiness("staging", stagingConfig, { fetcher, queryMigrationTracker: async () => tracker([], false), expectedVersions });
    expect(result).toMatchObject({ ready: false, migrationTrackerExists: false, latestVersion: null, missingVersions: expectedVersions });
  });

  it("mengikuti 0041 ketika berkas migrasi ditambahkan, tanpa menyatakan SQL sudah terpasang", async () => {
    const repo = repositoryMigrationVersions(["0039_initial.sql", "0040_hardening.sql", "0041_new.sql", "README.md"]);
    expect(repo).toEqual(["0039", "0040", "0041"]);
    const fetcher = vi.fn().mockResolvedValueOnce(response({ users: [] })).mockResolvedValueOnce(response(REQUIRED_BUCKETS.map((id) => ({ id }))));
    const result = await checkReadiness("develop", config, { fetcher, queryMigrationTracker: async () => tracker(["0039", "0040"]), expectedVersions: repo });
    expect(result).toMatchObject({ ready: false, expectedLatestVersion: "0041", latestVersion: "0040", missingVersions: ["0041"] });
  });
});
