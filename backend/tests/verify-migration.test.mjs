import assert from "node:assert/strict";
import test from "node:test";
import {
  buildChecksumQuery,
  buildEvidenceReports,
  buildOrphanQuery,
  assertDistinctDatabases,
  evaluateSnapshots,
  resolveVerificationConfig,
  safeIdentifier,
  verifyStorageBytes,
  writeEvidenceReports,
} from "../scripts/verify-migration.mjs";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateEvidenceReport } from "../../scripts/evaluate-selfhosted-uat-gate.mjs";

test("checksum query hashes selected columns without exposing row values", () => {
  const query = buildChecksumQuery("utero_academy", "user_profiles", ["id", "email"]);
  assert.match(query, /sha256/);
  assert.match(query, /jsonb_build_array\(t\."id", t\."email"\)/);
  assert.match(query, /order by row_hash/);
  assert.doesNotMatch(query, /select \*/);
});

test("storage byte verifier compares source and internal storage content", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "academy-storage-verify-"));
  const source = path.join(root, "source");
  const target = path.join(root, "target");
  await mkdir(path.join(source, "gallery"), { recursive: true });
  await mkdir(path.join(target, "gallery"), { recursive: true });
  await writeFile(path.join(source, "gallery", "one.txt"), "same");
  await writeFile(path.join(target, "gallery", "one.txt"), "same");
  try {
    assert.deepEqual(await verifyStorageBytes([{ bucket_id: "gallery", name: "one.txt", byte_size: "4" }], source, target), []);
    await writeFile(path.join(target, "gallery", "one.txt"), "other");
    assert.deepEqual(await verifyStorageBytes([{ bucket_id: "gallery", name: "one.txt", byte_size: "4" }], source, target), ["storage_bytes:gallery/one.txt"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("identifier validation rejects SQL fragments", () => {
  assert.equal(safeIdentifier("user_profiles"), '"user_profiles"');
  assert.throws(() => safeIdentifier("users; drop table auth.users"), /Identifier tidak aman/);
});

test("orphan query supports composite foreign keys safely", () => {
  const query = buildOrphanQuery({
    constraint_name: "child_parent_fk",
    child_schema: "utero_academy",
    child_table: "child",
    parent_schema: "utero_academy",
    parent_table: "parent",
    child_columns: ["tenant_id", "parent_id"],
    parent_columns: ["tenant_id", "id"],
  });
  assert.match(query, /c\."tenant_id" is not null and c\."parent_id" is not null/);
  assert.match(query, /p\."tenant_id" = c\."tenant_id" and p\."id" = c\."parent_id"/);
});

test("snapshot evaluation reports checksum, storage, and foreign key failures", () => {
  const source = {
    tables: {
      missingTables: ["missing_table"],
      result: {
        users: { source: { row_count: "1", checksum: "a" }, target: { row_count: "1", checksum: "b" } },
        roles: { missingColumns: ["code"] },
      },
    },
    auth: { users: { source: { row_count: "1", checksum: "a" }, target: { row_count: "1", checksum: "a" } } },
    roles: [{ code: "admin" }],
    files: [{ bucket_id: "gallery", name: "one.png", byte_size: "1" }],
    foreignKeys: [{ constraint: "auth.identities.identities_user_id_fkey", validated: false, orphanCount: "1" }],
  };
  const target = {
    roles: [{ code: "admin" }],
    files: [],
    foreignKeys: [{ constraint: "utero_academy.user_profiles.user_id_fkey", validated: true, orphanCount: "2" }],
  };
  assert.deepEqual(evaluateSnapshots(source, target), [
    "missing_table:missing_table",
    "table_checksum:users",
    "missing_columns:roles",
    "storage_manifest",
    "source_fk_not_validated:auth.identities.identities_user_id_fkey",
    "source_fk_orphan:auth.identities.identities_user_id_fkey",
    "target_fk_orphan:utero_academy.user_profiles.user_id_fkey",
  ]);
});

test("verification config defaults to UAT and production requires an explicit target", () => {
  const base = {
    SOURCE_DATABASE_URL: "postgres://source@source-db/academy",
    TARGET_DATABASE_URL: "postgres://target@target-db/academy",
    SOURCE_STORAGE_ROOT: "/import",
    TARGET_STORAGE_ROOT: "/srv/storage",
    OPS_EVIDENCE_ROOT: path.resolve("evidence"),
  };
  assert.equal(resolveVerificationConfig(base).target, "uat");
  assert.equal(resolveVerificationConfig({ ...base, MIGRATION_VERIFY_TARGET: "production" }).target, "production");
  assert.throws(() => resolveVerificationConfig({ ...base, MIGRATION_VERIFY_TARGET: "prod" }), /uat atau production/);
  assert.throws(() => resolveVerificationConfig({ ...base, OPS_EVIDENCE_ROOT: "relative" }), /path absolut/);
});

test("database identity rejects source and target aliases for the same database", () => {
  assert.throws(() => assertDistinctDatabases(
    "postgres://reader:one@DB.EXAMPLE/academy",
    "postgresql://writer:two@db.example:5432/academy",
  ), /tidak boleh sama/);
  assert.doesNotThrow(() => assertDistinctDatabases(
    "postgres://reader@source.example/academy",
    "postgres://reader@target.example/academy",
  ));
});

test("evidence reports match UAT evaluator fields and separate migration from storage failures", () => {
  const reports = buildEvidenceReports({
    migrationFailures: [],
    storageFailures: ["storage_bytes:gallery/one.txt"],
    tableCount: 12,
    foreignKeysChecked: 8,
    authUsers: "4",
    storageObjects: 3,
    storageBytesChecked: 2,
  }, "uat", new Date("2026-10-15T00:00:00.000Z"));
  assert.deepEqual(reports.migrationVerification.failures, []);
  assert.equal(reports.migrationVerification.status, "PASS");
  assert.equal(reports.migrationVerification.tableCount, 12);
  assert.equal(reports.migrationVerification.foreignKeysChecked, 8);
  assert.deepEqual(reports.storageVerification.failures, ["storage_bytes:gallery/one.txt"]);
  assert.equal(reports.storageVerification.status, "FAIL");
  assert.equal(reports.storageVerification.storageObjects, 3);
  assert.equal(reports.storageVerification.storageBytesChecked, 2);
  assert.equal(validateEvidenceReport("migrationVerification", reports.migrationVerification), true);
  assert.throws(() => validateEvidenceReport("storageVerification", reports.storageVerification), /failures wajib kosong/);
});

test("evidence writer atomically creates both JSON files under an absolute root", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "academy-migration-evidence-"));
  const reports = buildEvidenceReports({
    migrationFailures: [], storageFailures: [], tableCount: 1, foreignKeysChecked: 2,
    authUsers: "1", storageObjects: 0, storageBytesChecked: 0,
  }, "production", new Date("2026-10-15T00:00:00.000Z"));
  try {
    assert.equal(validateEvidenceReport("migrationVerification", reports.migrationVerification), true);
    assert.equal(validateEvidenceReport("storageVerification", reports.storageVerification), true);
    const written = await writeEvidenceReports(reports, root);
    assert.equal(path.dirname(written.migrationVerification), root);
    assert.equal(path.dirname(written.storageVerification), root);
    assert.equal(JSON.parse(await readFile(written.migrationVerification, "utf8")).gate, "migrationVerification");
    assert.equal(JSON.parse(await readFile(written.storageVerification, "utf8")).gate, "storageVerification");
    assert.deepEqual((await readdir(root)).sort(), ["migration-verification.json", "storage-verification.json"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
