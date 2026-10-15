import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const modulePath = "../scripts/adopt-phase13-baseline.mjs";
const { CATALOG_QUERIES, REVIEW_DECISION_COUNTS, adoptBaseline, canonicalJson, fingerprintCatalog, parseArgs, validateManifest } = await import(modulePath);

const hash = "a".repeat(64);
const migrations = [
  { version: "0001", filename: "0001_initial_schema.sql", checksum: "b".repeat(64) },
  { version: "0030a", filename: "0030a_policies_identity.sql", checksum: "c".repeat(64) },
  { version: "0037", filename: "0037_lms_publish_not_null.sql", checksum: "d".repeat(64) },
];
const manifest = {
  schemaVersion: 1,
  purpose: "phase13-baseline-adoption",
  target: "develop",
  baselineThrough: "0037",
  database: { name: "postgres", host: "20.20.20.173" },
  review: { approved: true, operator: "operator@example.test", reviewedBy: "reviewer@example.test", reviewedAt: "2026-10-12T00:00:00.000Z", expiresAt: "2026-10-20T00:00:00.000Z",
    decisions: Object.fromEntries(Object.entries(REVIEW_DECISION_COUNTS).map(([category, count]) => [category,
      Array.from({ length: count as number }, (_, index) => ({ id: `${category}-${index}`, disposition: "PRESERVE_RESTRICTED", rationale: "Reviewed against final clone evidence" }))])) },
  catalog: { queryVersion: "phase13-baseline-catalog-v1", sha256: hash },
  evidence: {
    cleanReplay: { status: "PASS", sha256: hash },
    curatedDiff: { status: "REVIEWED", sha256: hash },
    rlsMatrix: { status: "PASS", sha256: hash },
    storageOwnership: { status: "REVIEWED", sha256: hash },
    sharedBackup: { status: "RESTORE_VERIFIED", sha256: hash },
    restoreDrill: { status: "PASS", sha256: hash },
  },
  migrations,
};

describe("phase13 baseline adoption", () => {
  it("default ke dry-run dan menolak target production", () => {
    expect(parseArgs(["--target", "develop", "--manifest", "evidence.json"]).mode).toBe("dry-run");
    expect(() => parseArgs(["--target", "production", "--manifest", "evidence.json"])).toThrow("dilarang");
    expect(() => parseArgs(["--target", "develop", "--manifest", "evidence.json", "--apply"])).toThrow("ack-manifest");
  });

  it("menolak --apply sebelum membaca manifest atau membuka database", () => {
    const result = spawnSync(process.execPath, [resolve("scripts/adopt-phase13-baseline.mjs"),
      "--target", "develop", "--manifest", "manifest-tidak-ada.json", "--apply", "--ack-manifest-sha256", hash],
    { encoding: "utf8", env: { ...process.env, DATABASE_URL: "" } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--apply dinonaktifkan");
    expect(result.stderr).not.toContain("ENOENT");
  });

  it("memvalidasi review, expiry, identitas, dan checksum evidence", () => {
    expect(validateManifest(manifest, migrations, hash, new Date("2026-10-13T00:00:00Z"))).toMatchObject({ reviewedBy: "reviewer@example.test", expectedCatalogSha256: hash });
    expect(() => validateManifest({ ...manifest, review: { ...manifest.review, reviewedBy: "OPERATOR@example.test" } }, migrations, hash, new Date("2026-10-13T00:00:00Z"))).toThrow("Reviewer independen");
    expect(() => validateManifest({ ...manifest, review: { ...manifest.review, decisions: { ...manifest.review.decisions, policies: [] } } }, migrations, hash, new Date("2026-10-13T00:00:00Z"))).toThrow("policies");
    expect(() => validateManifest({ ...manifest, target: "production" }, migrations, hash, new Date("2026-10-13T00:00:00Z"))).toThrow("production");
    expect(() => validateManifest({ ...manifest, migrations: [] }, migrations, hash, new Date("2026-10-13T00:00:00Z"))).toThrow("checksum");
    expect(() => validateManifest({ ...manifest, evidence: undefined }, migrations, hash, new Date("2026-10-13T00:00:00Z"))).toThrow("Bukti");
    expect(() => validateManifest({ ...manifest, review: { ...manifest.review, expiresAt: "2026-10-12T00:00:00Z" } }, migrations, hash, new Date("2026-10-13T00:00:00Z"))).toThrow("Masa berlaku");
  });

  it("membuat fingerprint stabil terhadap urutan key object", () => {
    const catalog = Object.fromEntries(Object.keys(CATALOG_QUERIES).map((key) => [key, [{ z: 1, a: "x" }]]));
    const reordered = Object.fromEntries(Object.keys(CATALOG_QUERIES).map((key) => [key, [{ a: "x", z: 1 }]]));
    expect(canonicalJson(catalog)).not.toBe(JSON.stringify(catalog));
    expect(fingerprintCatalog(catalog)).toBe(fingerprintCatalog(reordered));
  });

  it("menolak helper write bahkan saat dipanggil langsung", async () => {
    const queries: Array<{ sql: string; parameters?: unknown[] }> = [];
    const client = { query: async (sql: string, parameters?: unknown[]) => {
      queries.push({ sql, parameters });
      if (sql.startsWith("SELECT current_database")) return { rows: [{ database: "postgres", host: "20.20.20.173", in_recovery: false }] };
      if (sql.startsWith("SELECT to_regclass")) return { rows: [{ present: false }] };
      if (Object.values(CATALOG_QUERIES).includes(sql)) return { rows: [] };
      return { rows: [] };
    } };
    await expect(adoptBaseline(client, manifest, migrations, { reviewedBy: "reviewer", manifestSha256: hash, expectedCatalogSha256: hash })).rejects.toThrow("belum diaktifkan");
    expect(queries).toHaveLength(0);
    expect(queries.some(({ sql }) => sql.startsWith("INSERT INTO"))).toBe(false);
  });

  it("menolak helper write walaupun fingerprint dan manifest terlihat cocok", async () => {
    const emptyCatalog = Object.fromEntries(Object.keys(CATALOG_QUERIES).map((key) => [key, []]));
    const expectedCatalogSha256 = fingerprintCatalog(emptyCatalog);
    const queries: Array<{ sql: string; parameters?: unknown[] }> = [];
    const client = { query: async (sql: string, parameters?: unknown[]) => {
      queries.push({ sql, parameters });
      if (sql.startsWith("SELECT current_database")) return { rows: [{ database: "postgres", host: "20.20.20.173", in_recovery: false }] };
      if (sql.startsWith("SELECT to_regclass")) return { rows: [{ present: false }] };
      if (Object.values(CATALOG_QUERIES).includes(sql)) return { rows: [] };
      return { rows: [] };
    } };
    await expect(adoptBaseline(client, manifest, migrations, { reviewedBy: "reviewer", manifestSha256: hash, expectedCatalogSha256 })).rejects.toThrow("belum diaktifkan");
    expect(queries).toHaveLength(0);
  });
});
