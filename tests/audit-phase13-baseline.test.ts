import { describe, expect, it } from "vitest";

const modulePath = "../scripts/audit-phase13-baseline.mjs";
const { assessBaseline, historicalMigrations } = await import(modulePath) as {
  historicalMigrations: (filenames: string[]) => Array<{ version: string; filename: string }>;
  assessBaseline: (migrations: Array<{ version: string; filename: string; checksum: string }>, snapshots: Array<{ name: string; objects: unknown[]; trackerExists?: boolean; tracking: Array<{ version: string; filename: string; checksum: string }> }>) => Record<string, unknown>;
};

describe("phase13 baseline audit", () => {
  it("membatasi histori ke 0001–0037 dan menjaga suffix", () => {
    expect(historicalMigrations(["0001_init.sql", "0030a_policy.sql", "0037_last.sql", "0038_next.sql", "README.md"]))
      .toEqual([
        { version: "0001", filename: "0001_init.sql" },
        { version: "0030a", filename: "0030a_policy.sql" },
        { version: "0037", filename: "0037_last.sql" },
      ]);
  });

  it("tidak pernah menyatakan baseline terbukti dari dua snapshot identik", () => {
    const migrations = [{ version: "0001", filename: "0001_init.sql", checksum: "abc" }];
    const tracking = [{ version: "0001", filename: "0001_init.sql", checksum: "abc" }];
    const report = assessBaseline(migrations, [
      { name: "develop", objects: [{ relname: "users" }], tracking },
      { name: "production", objects: [{ relname: "users" }], tracking },
    ]);
    expect(report).toMatchObject({ sameCurrentCatalog: true, baselineProven: false });
  });

  it("melaporkan tracker hilang dan checksum menyimpang", () => {
    const migrations = [{ version: "0001", filename: "0001_init.sql", checksum: "expected" }];
    const report = assessBaseline(migrations, [
      { name: "develop", objects: [], tracking: [], trackerExists: false },
      { name: "production", objects: [], tracking: [{ version: "0001", filename: "0001_init.sql", checksum: "wrong" }] },
    ]) as { snapshots: Array<{ trackerExists: boolean; missingTracking: string[]; mismatchedTracking: string[] }> };
    expect(report.snapshots[0].trackerExists).toBe(false);
    expect(report.snapshots[0].missingTracking).toEqual(["0001"]);
    expect(report.snapshots[1].mismatchedTracking).toEqual(["0001"]);
  });
});
