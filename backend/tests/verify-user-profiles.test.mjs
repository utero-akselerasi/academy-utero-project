import assert from "node:assert/strict";
import test from "node:test";
import { evaluateIdentityOnlyMigration, resolveIdentityVerifyConfig, verifyIdentityOnlyMigration } from "../scripts/verify-user-profiles.mjs";

const profile = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "USER@example.com",
  full_name: "Nama Pengguna",
  phone: "0812",
  avatar_path: null,
  is_active: true,
  created_at: "2026-10-15T00:00:00.000Z",
  updated_at: "2026-10-15T01:00:00.000Z",
};

const cleanCounts = {
  users: 1,
  profiles: 1,
  identities: 1,
  emailIdentities: 1,
  passwordHashes: 0,
  confirmedEmails: 0,
  sessions: 0,
  roleAssignments: 0,
  domainRows: 0,
  storageObjects: 0,
};

test("evidence identitas-only lulus tanpa password, role, domain, dan storage", () => {
  const report = evaluateIdentityOnlyMigration([profile], [{ ...profile, email: "user@example.com" }], cleanCounts, "production", new Date("2026-10-16T00:00:00Z"));
  assert.equal(report.status, "PASS");
  assert.equal(report.gate, "identityOnlyMigration");
  assert.equal(report.counts.sourceProfiles, 1);
  assert.equal(report.checksums.sourceProfiles, report.checksums.targetProfiles);
});

test("evidence identitas-only gagal bila target membawa data terlarang", () => {
  const report = evaluateIdentityOnlyMigration([profile], [profile], { ...cleanCounts, roleAssignments: 1, storageObjects: 2 });
  assert.equal(report.status, "FAIL");
  assert.equal(report.checks.noRoleAssignments, false);
  assert.equal(report.checks.noStorageObjects, false);
});

test("evidence identitas-only gagal bila ada profil yatim atau provider lain", () => {
  const report = evaluateIdentityOnlyMigration([profile], [profile], { ...cleanCounts, profiles: 2, identities: 2 });
  assert.equal(report.status, "FAIL");
  assert.equal(report.checks.profileCount, false);
  assert.equal(report.checks.emailIdentities, false);
});

test("config production mewajibkan output absolut dan database berbeda", () => {
  const base = {
    SOURCE_DATABASE_URL: "postgresql://reader:secret@source:5432/source",
    TARGET_DATABASE_URL: "postgresql://writer:secret@target:5432/academy",
    IDENTITY_VERIFY_TARGET: "production",
  };
  assert.throws(() => resolveIdentityVerifyConfig(base), /Production wajib/);
  const config = resolveIdentityVerifyConfig({ ...base, IDENTITY_VERIFY_OUTPUT: "/evidence/identity.json" });
  assert.equal(config.target, "production");
  assert.throws(() => resolveIdentityVerifyConfig({ ...base, TARGET_DATABASE_URL: base.SOURCE_DATABASE_URL, IDENTITY_VERIFY_OUTPUT: "/evidence/identity.json" }), /tidak boleh sama/);
});

test("verifier membaca kedua database read-only dan menolak row domain non-seed", async () => {
  const queries = { source: [], target: [] };
  const source = { async query(sql) {
    queries.source.push(sql);
    if (sql.includes("current_database()")) return { rows: [{ identity: "source|1|5432" }] };
    if (sql.includes("from utero_academy.user_profiles profiles")) return { rows: [profile] };
    return { rows: [] };
  } };
  const target = { async query(sql) {
    queries.target.push(sql);
    if (sql.includes("current_database()")) return { rows: [{ identity: "target|2|5432" }] };
    if (sql.includes("from utero_academy.user_profiles profiles")) return { rows: [profile] };
    if (sql.includes("from auth.users) users")) return { rows: [{ ...cleanCounts, domainRows: undefined }] };
    if (sql.includes("from pg_tables")) return { rows: [{ tablename: "internship_applications" }] };
    if (sql.includes('from utero_academy."internship_applications"')) return { rows: [{ count: 1 }] };
    return { rows: [] };
  } };
  const report = await verifyIdentityOnlyMigration(source, target);
  assert.equal(report.status, "FAIL");
  assert.equal(report.checks.noDomainRows, false);
  for (const database of ["source", "target"]) {
    assert.ok(queries[database].includes("begin isolation level repeatable read read only"));
    assert.equal(queries[database].at(-1), "rollback");
    assert.equal(queries[database].some((sql) => /\b(insert|update|delete|truncate)\b/i.test(sql)), false);
  }
});
