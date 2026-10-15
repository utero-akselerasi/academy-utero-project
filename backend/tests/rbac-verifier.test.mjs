import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ACTIVE_ROLES, EXPECTED_PERMISSIONS, NONASSIGNABLE_ROLES, createRbacVerificationEvidence,
  verifyRbacSnapshot, writeRbacVerificationEvidence,
} from "../scripts/verify-rbac.mjs";
import { validateEvidenceReport } from "../../scripts/evaluate-selfhosted-uat-gate.mjs";

function validSnapshot() {
  return {
    roles: [
      ...ACTIVE_ROLES.map((code) => ({ code, is_assignable: true, permissions: EXPECTED_PERMISSIONS[code] })),
      ...NONASSIGNABLE_ROLES.map((code) => ({ code, is_assignable: false, permissions: [] })),
    ],
    orphanAssignments: [], malformedScopes: [], activeScopedAssignments: [], duplicateAssignments: [],
  };
}

test("matriks verifier sama dengan seed RBAC Supabase", async () => {
  const seed = await readFile(new URL("../../supabase/seed/0001_rbac_seed.sql", import.meta.url), "utf8");
  for (const code of EXPECTED_PERMISSIONS.super_admin) assert.match(seed, new RegExp(`'${code.replace(".", "\\.")}'`));
  for (const role of ["admin", "school", "intern"]) {
    const block = [...seed.matchAll(/join utero_academy\.permissions p on p\.code in \(([^)]*)\)\s*where r\.code = '([^']+)'/g)]
      .find((match) => match[2] === role)?.[1] ?? "";
    const permissions = [...block.matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
    assert.deepEqual(permissions, EXPECTED_PERMISSIONS[role]);
  }
  assert.deepEqual(EXPECTED_PERMISSIONS.applicant, []);
});

test("snapshot RBAC setara dinyatakan valid", () => {
  const result = verifyRbacSnapshot(validSnapshot());
  assert.equal(result.ok, true);
  assert.deepEqual(result.permissionCounts, { admin: 21, applicant: 0, intern: 6, school: 6, super_admin: 26 });
});

test("evidence production kompatibel dengan gate dan berlaku tepat 24 jam", () => {
  const now = new Date("2026-10-15T01:02:03.000Z");
  const report = createRbacVerificationEvidence(verifyRbacSnapshot(validSnapshot()), "production", now);
  assert.equal(report.gate, "rbacVerification");
  assert.equal(report.target, "production");
  assert.equal(report.status, "PASS");
  assert.deepEqual(report.roles, ACTIVE_ROLES);
  assert.equal(report.permissionMismatchCount, 0);
  assert.equal(report.orphanAssignmentCount, 0);
  assert.equal(report.finishedAt, now.toISOString());
  assert.equal(Date.parse(report.expiresAt) - Date.parse(report.finishedAt), 24 * 60 * 60 * 1000);
  assert.equal(validateEvidenceReport("rbacVerification", report), true);
});

test("evidence hanya PASS bila verifier lama lulus", () => {
  const snapshot = validSnapshot();
  snapshot.roles.find((role) => role.code === "admin").permissions = [];
  snapshot.orphanAssignments.push({ id: "orphan" });
  const report = createRbacVerificationEvidence(verifyRbacSnapshot(snapshot));
  assert.equal(report.target, "local");
  assert.equal(report.status, "FAIL");
  assert.equal(report.permissionMismatchCount, 1);
  assert.equal(report.orphanAssignmentCount, 1);
});

test("evidence ditulis atomik ke path absolut", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "rbac-evidence-"));
  try {
    const output = path.join(directory, "rbacVerification.json");
    const report = createRbacVerificationEvidence(verifyRbacSnapshot(validSnapshot()));
    assert.equal(await writeRbacVerificationEvidence(report, output), output);
    assert.deepEqual(JSON.parse(await readFile(output, "utf8")), report);
    assert.deepEqual(await readdir(directory), ["rbacVerification.json"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("legacy yang tidak ada pada database bersih tidak wajib dibuat", () => {
  const snapshot = validSnapshot();
  snapshot.roles = snapshot.roles.filter((role) => !["mentor", "admin_academy"].includes(role.code));
  assert.equal(verifyRbacSnapshot(snapshot).ok, true);
});

test("verifier menolak penyimpangan role dan permission", () => {
  const snapshot = validSnapshot();
  snapshot.roles.find((role) => role.code === "visitor").is_assignable = true;
  snapshot.roles.find((role) => role.code === "admin").permissions = [];
  const invariants = verifyRbacSnapshot(snapshot).failures.map((failure) => failure.invariant);
  assert.ok(invariants.includes("active_roles"));
  assert.ok(invariants.includes("nonassignable_roles"));
  assert.ok(invariants.includes("role_permissions"));
});

test("verifier menolak assignment yatim, scope rusak, scope aktif, dan duplikat", () => {
  const snapshot = validSnapshot();
  snapshot.orphanAssignments.push({ id: "orphan" });
  snapshot.malformedScopes.push({ id: "half-scope" });
  snapshot.activeScopedAssignments.push({ id: "unsafe-scope", code: "school" });
  snapshot.duplicateAssignments.push({ user_id: "u", role_id: "r", count: 2 });
  assert.deepEqual(
    verifyRbacSnapshot(snapshot).failures.map((failure) => failure.invariant),
    ["orphan_assignments", "scope_pair", "active_role_scope", "duplicate_assignments"],
  );
});
