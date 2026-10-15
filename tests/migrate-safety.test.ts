import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");
const runnerPath = path.join(repoRoot, "scripts", "migrate.mjs");
const source = fs.readFileSync(runnerPath, "utf8");

describe("migrate runner fail-closed safety", () => {
  it("keeps dry-run offline", () => {
    const output = execFileSync(process.execPath, [runnerPath, "--dry-run"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: "" },
    });

    expect(output).toContain("Mode dry-run: tidak ada koneksi ke database");
  });

  it("disables baseline before reading DATABASE_URL or connecting", () => {
    const result = spawnSync(process.execPath, [runnerPath, "--baseline", "0037"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: "" },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--baseline dinonaktifkan");
    expect(result.stderr).not.toContain("DATABASE_URL tidak diset");
  });

  it("reads status without creating tracker", () => {
    const statusBlock = source.slice(
      source.indexOf('if (options.mode === "status")'),
      source.indexOf('// options.mode === "apply"'),
    );

    expect(source).toContain("to_regclass('utero_academy.schema_migrations')");
    expect(statusBlock).not.toContain("ensureTrackingTable");
    expect(statusBlock).not.toMatch(/create\s+(schema|table)/i);
  });

  it("refuses historical migrations on an existing Academy schema", () => {
    const guard = source.indexOf('migration.version <= "0037"');
    const trackerCreation = source.lastIndexOf("if (!hasTracker) await ensureTrackingTable(client)");
    const applyLoop = source.indexOf("for (const migration of pending)");

    expect(source).toContain("to_regnamespace('utero_academy')");
    expect(source).toContain("--apply ditolak");
    expect(guard).toBeGreaterThan(-1);
    expect(trackerCreation).toBeGreaterThan(guard);
    expect(applyLoop).toBeGreaterThan(trackerCreation);
  });
});
