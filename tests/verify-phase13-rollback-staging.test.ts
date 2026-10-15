import { mkdtemp, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const modulePath = "../scripts/verify-phase13-rollback-staging.mjs";
const { validateRollbackConfig, verifyRollback, verifyArtifactDigests } = await import(modulePath) as {
  validateRollbackConfig: (env: Record<string, string>, evidence: Record<string, unknown>) => string;
  verifyRollback: (env: Record<string, string>, evidence: Record<string, unknown>, dependencies: {
    fetcher: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn>;
  }) => Promise<Record<string, unknown>>;
  verifyArtifactDigests: (evidence: Record<string, unknown>, files: Record<string, string>) => Promise<void>;
};
const env = { DEPLOY_TARGET: "staging", SUPABASE_STAGING_URL: "http://127.0.0.1:18200",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100", SUPABASE_STAGING_SERVICE_ROLE_KEY: "test",
  SUPABASE_STAGING_DATABASE_URL: "postgres://operator:secret@127.0.0.1:15632/postgres" };
const evidence = { target: "staging", endpoint: env.SUPABASE_STAGING_URL,
  database: "postgres@127.0.0.1:15632/postgres", app: env.NEXT_PUBLIC_APP_URL,
  sourceInstance: "supabase-02", replacementInstance: "supabase-02-rollback-20261013",
  replacementIdentitySha256: "d".repeat(64),
  snapshotSha256: "a".repeat(64), storageSha256: "b".repeat(64), configSha256: "c".repeat(64),
  authUsers: 2, academyProfiles: 2, storageObjects: 3, storageBucket: "academy-private" };

describe("rollback staging", () => {
  it.each([
    { ...env, DEPLOY_TARGET: "production" },
    { ...env, SUPABASE_STAGING_URL: "https://supabase.carubra.space" },
    { ...env, SUPABASE_STAGING_DATABASE_URL: "postgres://operator:secret@20.20.20.3:5432/postgres" },
    { ...env, NEXT_PUBLIC_APP_URL: "https://academy.example.com" },
    { ...env, SUPABASE_STAGING_URL: "http://127.0.0.1:18100" },
    { ...env, SUPABASE_STAGING_DATABASE_URL: "postgres://operator:secret@127.0.0.1:15532/postgres" },
  ])("menolak target tidak aman sebelum koneksi", (unsafe) => {
    expect(() => validateRollbackConfig(unsafe, evidence)).toThrow();
  });

  it("gagal tertutup bila manifest tidak lengkap", () => {
    expect(() => validateRollbackConfig(env, { ...evidence, storageSha256: "" })).toThrow();
  });

  it("menolak identitas source sebagai replacement", () => {
    expect(() => validateRollbackConfig(env, { ...evidence, replacementInstance: "supabase-02" })).toThrow();
  });

  it("mewajibkan hash DB Storage dan config cocok", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "rollback-staging-"));
    const files = { snapshot: path.join(directory, "snapshot.dump"), storage: path.join(directory, "storage.tar"),
      config: path.join(directory, "config.tgz") };
    await Promise.all(Object.entries(files).map(([name, file]) => writeFile(file, name)));
    const digests = Object.fromEntries(Object.entries(files).map(([name]) =>
      [name === "snapshot" ? "snapshotSha256" : `${name}Sha256`, createHash("sha256").update(name).digest("hex")]));
    await expect(verifyArtifactDigests({ ...evidence, ...digests }, files)).resolves.toBeUndefined();
    await expect(verifyArtifactDigests({ ...evidence, ...digests, storageSha256: "0".repeat(64) }, files))
      .rejects.toThrow("arsip Storage");
  });

  it("memeriksa Auth DB Storage app dengan GET dan query baca-saja", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ users: [{}], total: 2 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "academy-private" }] })
      .mockResolvedValueOnce({ ok: true });
    const query = vi.fn().mockResolvedValueOnce([{ count: 2 }]).mockResolvedValueOnce([{ count: 3 }]);
    await expect(verifyRollback(env, evidence, { fetcher, query })).resolves.toMatchObject({ ready: true, target: "staging" });
    expect(fetcher.mock.calls.every(([, options]) => options.method === "GET")).toBe(true);
    expect(query.mock.calls.every(([, sql]) => sql.startsWith("SELECT"))).toBe(true);
  });

  it("menolak jumlah hasil restore berbeda", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ users: [], total: 1 }) });
    await expect(verifyRollback(env, evidence, { fetcher, query: vi.fn() })).rejects.toThrow("Auth");
  });
});
