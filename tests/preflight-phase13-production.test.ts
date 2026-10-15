import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const modulePath = "../scripts/preflight-phase13-production.mjs";
const { checkProduction, databaseSnapshot, assessPreflight, validateBaseline, verifyBaselineSource } = await import(modulePath);
const config = { endpoint: "https://supabase.carubra.space", databaseUrl: "postgres://operator:password@20.20.20.3/postgres", serviceKey: "secret", sshUser: "operator" };
const snapshot = { data: [
  { name: "utero_academy.attendances", count: "1180" }, { name: "utero_academy.daily_reports", count: "1032" },
  { name: "utero_academy.daily_report_attachments", count: "1307" }, { name: "auth.users", count: "209" },
  { name: "storage.objects:avatars", count: "417" },
], rls: [{ name: "utero_academy.attendances", enabled: true }], policies: [{ name: "storage.objects", policyname: "limited" }], buckets: [{ id: "avatars", public: true }] };
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const baseline = { version: 1, target: "production", status: "REVIEWED", synthetic: false,
  evidence: { source: "historical-production-clone", cloneDatabase: "phase13_current_prod", readOnlyCapture: true,
    sourcePath: "I:\\secure-evidence\\phase13-current-prod-baseline.json", sourceSha256: "a".repeat(64),
    capturedAt: "2026-10-13T01:00:00Z", reviewedAt: "2026-10-13T01:10:00Z", operator: "operator-a", reviewer: "reviewer-b" },
  counts: Object.fromEntries(snapshot.data.map(({ name, count }) => [name, Number(count)])),
  minFreeKiB: 1024, rlsSha256: hash(snapshot.rls), policiesSha256: hash(snapshot.policies), bucketsSha256: hash(snapshot.buckets) };
const disk = [{ mount: "/", freeKiB: 2048 }, { mount: "/data", freeKiB: 2048 }];
const verifySource = async () => true;

describe("production preflight baca-saja", () => {
  it("mencocokkan hash berkas sumber non-synthetic sebelum koneksi live", async () => {
    const root = await mkdtemp(join(tmpdir(), "phase13-baseline-source-"));
    try {
      const sourcePath = join(root, "capture.json");
      const bytes = Buffer.from(JSON.stringify({ source: "historical-production-clone", reviewed: true }));
      await writeFile(sourcePath, bytes);
      const evidence = { ...baseline.evidence, sourcePath, sourceSha256: createHash("sha256").update(bytes).digest("hex") };
      await expect(verifyBaselineSource({ ...baseline, evidence }, new Date("2026-10-14T00:00:00Z"))).resolves.toBe(true);
      await expect(verifyBaselineSource({ ...baseline, evidence: { ...evidence, sourceSha256: "a".repeat(64) } })).rejects.toThrow("Hash");
      await expect(verifyBaselineSource({ ...baseline, evidence }, new Date("2026-10-12T00:00:00Z"))).rejects.toThrow("masa depan");
    } finally {
      await unlink(join(root, "capture.json")).catch(() => {});
      await rmdir(root);
    }
  });
  it("menolak baseline kosong dan target salah sebelum I/O", async () => {
    expect(() => validateBaseline({})).toThrow();
    const fetcher = vi.fn();
    await expect(checkProduction({ ...config, endpoint: "https://supabase.carubra.com" }, baseline, { fetcher, verifySource })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("menolak baseline synthetic atau tanpa review sebelum I/O", async () => {
    const fetcher = vi.fn();
    await expect(checkProduction(config, { ...baseline, synthetic: true }, { fetcher, verifySource })).rejects.toThrow("synthetic");
    await expect(checkProduction(config, { ...baseline, status: "DRAFT" }, { fetcher, verifySource })).rejects.toThrow("reviewed");
    await expect(checkProduction(config, { ...baseline, evidence: { ...baseline.evidence, source: "final-backup" } }, { fetcher, verifySource }))
      .rejects.toThrow("reviewed");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("hanya GET dan seluruh bukti harus cocok", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const report = await checkProduction(config, baseline, { fetcher, snapshot: async () => snapshot, diskReader: async () => disk, verifySource });
    expect(report.ready).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(3);
    for (const [, options] of fetcher.mock.calls) expect(options.method).toBe("GET");
  });

  it("delta, disk, RLS, policy atau bucket berubah menutup gate", () => {
    for (const changed of [
      { ...snapshot, data: snapshot.data.slice(1) },
      { ...snapshot, data: snapshot.data.map((row) => ({ ...row, count: "0" })) },
      { ...snapshot, rls: [{ name: "utero_academy.attendances", enabled: false }] },
      { ...snapshot, policies: [] },
      { ...snapshot, buckets: [] },
    ]) expect(assessPreflight(baseline, changed, disk).ready).toBe(false);
    expect(assessPreflight(baseline, snapshot, [{ mount: "/", freeKiB: 1 }, disk[1]]).ready).toBe(false);
  });

  it("mengizinkan hanya tracker internal tanpa RLS dan tanpa privilege aplikasi", () => {
    const withTracker = { ...snapshot, rls: [...snapshot.rls,
      { name: "utero_academy.schema_migrations", enabled: false, forced: false, app_privileged: false }] };
    const reviewed = { ...baseline, rlsSha256: hash(withTracker.rls) };
    expect(assessPreflight(reviewed, withTracker, disk).checks.rls).toBe(true);
    const exposed = { ...withTracker, rls: withTracker.rls.map((row) =>
      row.name === "utero_academy.schema_migrations" ? { ...row, app_privileged: true } : row) };
    expect(assessPreflight({ ...baseline, rlsSha256: hash(exposed.rls) }, exposed, disk).checks.rls).toBe(false);
    const other = { ...withTracker, rls: [...withTracker.rls,
      { name: "utero_academy.unprotected", enabled: false, forced: false, app_privileged: false }] };
    expect(assessPreflight({ ...baseline, rlsSha256: hash(other.rls) }, other, disk).checks.rls).toBe(false);
  });

  it("service gagal menghentikan probe lain", async () => {
    const database = vi.fn();
    await expect(checkProduction(config, baseline, { fetcher: async () => ({ ok: false, status: 503 }), snapshot: database, verifySource })).rejects.toThrow("HTTP 503");
    expect(database).not.toHaveBeenCalled();
  });

  it("SQL dijalankan dalam transaksi read-only dengan rollback", async () => {
    const queries: string[] = [];
    class Client {
      async connect() {}
      async end() {}
      async query(sql: string) { queries.push(sql); return { rows: [] }; }
    }
    await databaseSnapshot(config.databaseUrl, Client);
    expect(queries[0]).toBe("BEGIN READ ONLY");
    expect(queries.at(-1)).toBe("ROLLBACK");
    expect(queries.slice(1, -1)).toHaveLength(4);
    expect(queries.slice(1, -1).every((sql) => /^SELECT\b/i.test(sql))).toBe(true);
  });
});
