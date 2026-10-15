import { describe, expect, it } from "vitest";

const modulePath = "../scripts/audit-phase13-shared-instance.mjs";
const { ACADEMY_BUCKETS, assessSharedInstance, captureSharedInstance } = await import(modulePath);

const snapshot = {
  target: "develop",
  academySchema: true,
  trackerPresent: true,
  academyTables: 63,
  academyFunctions: 9,
  academyPolicies: 145,
  academyUsers: 29,
  academyStorageObjects: 1233,
  globalAuthUsers: 208,
  globalStorageObjects: 4228,
  academyBuckets: [...ACADEMY_BUCKETS],
  sharedSchemas: ["buzzerhood", "soundpub", "utero_academy"],
  catalogCounts: { columns: 551, functions: 9, grants: 1341, indexes: 135, policies: 145 },
  catalogSha256: Object.fromEntries(["columns", "functions", "grants", "indexes", "policies"].map((key) => [key, "a".repeat(64)])),
};

describe("shared Supabase instance audit", () => {
  it("menilai hanya footprint Academy dan menandai total global sebagai konteks", () => {
    const report = assessSharedInstance("develop", snapshot);
    expect(report.status).toBe("SHARED_INSTANCE_AUDITED");
    expect(report.academy.users).toBe(29);
    expect(report.sharedContext.authUsersAllProjects).toBe(208);
    expect(report.academy.storageObjectOwnershipVerified).toBe(false);
    expect(report.sharedContext.countsAreReadinessEvidence).toBe(false);
  });

  it("menutup gate saat tracker atau bucket Academy hilang", () => {
    const report = assessSharedInstance("develop", { ...snapshot, trackerPresent: false,
      academyBuckets: snapshot.academyBuckets.filter((bucket: string) => bucket !== "academy-private") });
    expect(report.status).toBe("NO-GO");
    expect(report.blockers).toEqual(expect.arrayContaining(["tracker", "buckets"]));
    expect(report.missingBuckets).toEqual(["academy-private"]);
  });

  it("menolak pertukaran identitas dev dan production", () => {
    expect(() => assessSharedInstance("production", snapshot)).toThrow("Identitas");
  });

  it("capture memakai transaksi read-only dan memetakan count SQL", async () => {
    const queries: Array<{ sql: string; parameters: unknown[] }> = [];
    class Client {
      async connect() {}
      async end() {}
      async query(sql: string, parameters: unknown[] = []) {
        queries.push({ sql, parameters });
        if (sql.startsWith("SELECT current_database")) return { rows: [{ database: "postgres", academy_schema: true, tracker_present: true }] };
        if (sql.startsWith("SELECT (SELECT count")) return { rows: [{ academy_tables: 63, academy_functions: 9,
          academy_policies: 145, academy_users: 29, academy_storage_objects: 1233,
          global_auth_users: 208, global_storage_objects: 4228 }] };
        if (sql.startsWith("SELECT id FROM storage.buckets")) return { rows: ACADEMY_BUCKETS.map((id: string) => ({ id })) };
        if (sql.startsWith("SELECT nspname")) return { rows: [{ nspname: "buzzerhood" }, { nspname: "soundpub" }, { nspname: "utero_academy" }] };
        if (sql === "BEGIN READ ONLY" || sql === "ROLLBACK") return { rows: [] };
        return { rows: [{ row: "catalog" }] };
      }
    }
    const report = await captureSharedInstance("develop", {
      endpoint: "https://supabase.carubra.com",
      databaseUrl: "postgres://operator:password@20.20.20.173/postgres",
    }, Client);
    expect(report.status).toBe("SHARED_INSTANCE_AUDITED");
    expect(report.academy).toMatchObject({ users: 29, storageObjectsInCandidateBuckets: 1233, tables: 63 });
    expect(queries[0].sql).toBe("BEGIN READ ONLY");
    expect(queries.at(-1)?.sql).toBe("ROLLBACK");
    expect(queries.find(({ sql }) => sql.includes("storage.objects WHERE bucket_id"))?.parameters).toEqual([ACADEMY_BUCKETS]);
  });
});
