import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const EVIDENCE_LIFETIME_MS = 24 * 60 * 60 * 1000;

export const ACTIVE_ROLES = ["admin", "applicant", "intern", "school", "super_admin"];
export const NONASSIGNABLE_ROLES = ["admin_academy", "mentor", "visitor"];

export const EXPECTED_PERMISSIONS = {
  admin: [
    "applications.read", "applications.review", "assessments.finalize", "assessments.write",
    "attendance.review", "audit_logs.read", "certificates.generate", "certificates.read",
    "cms.publish", "cms.read", "cms.write", "daily_reports.review", "interns.manage",
    "interns.read", "lms.manage", "lms.read", "mentors.assign", "programs.manage",
    "tasks.manage", "tasks.read", "users.manage",
  ],
  applicant: [],
  intern: [
    "attendance.submit", "certificates.read", "daily_reports.submit", "lms.read",
    "tasks.read", "tasks.submit",
  ],
  school: [
    "attendance.review", "certificates.read", "daily_reports.review", "interns.read",
    "school_portal.read", "tasks.read",
  ],
  super_admin: [
    "applications.read", "applications.review", "assessments.finalize", "assessments.write",
    "attendance.review", "attendance.submit", "audit_logs.read", "certificates.generate",
    "certificates.read", "cms.publish", "cms.read", "cms.write", "daily_reports.review",
    "daily_reports.submit", "interns.manage", "interns.read", "lms.manage", "lms.read",
    "mentors.assign", "programs.manage", "roles.manage", "school_portal.read", "tasks.manage",
    "tasks.read", "tasks.submit", "users.manage",
  ],
};

const sorted = (values) => [...values].sort();

export function verifyRbacSnapshot(snapshot) {
  const failures = [];
  const active = sorted(snapshot.roles.filter((role) => role.is_assignable).map((role) => role.code));
  const inactive = sorted(snapshot.roles.filter((role) => !role.is_assignable).map((role) => role.code));

  if (JSON.stringify(active) !== JSON.stringify(ACTIVE_ROLES)) {
    failures.push({ invariant: "active_roles", expected: ACTIVE_ROLES, actual: active });
  }
  const unexpectedInactive = inactive.filter((role) => !NONASSIGNABLE_ROLES.includes(role));
  const assignableLegacy = snapshot.roles.filter((role) => NONASSIGNABLE_ROLES.includes(role.code) && role.is_assignable).map((role) => role.code);
  if (unexpectedInactive.length || assignableLegacy.length || !inactive.includes("visitor")) {
    failures.push({ invariant: "nonassignable_roles", expected: "visitor wajib ada; mentor/admin_academy nonassignable bila ada", actual: inactive });
  }

  const actualPermissions = Object.fromEntries(
    snapshot.roles.filter((role) => role.is_assignable).map((role) => [role.code, sorted(role.permissions)]),
  );
  for (const role of ACTIVE_ROLES) {
    const expected = EXPECTED_PERMISSIONS[role];
    const actual = actualPermissions[role] ?? [];
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push({ invariant: "role_permissions", role, expected, actual });
    }
  }

  if (snapshot.orphanAssignments.length) {
    failures.push({ invariant: "orphan_assignments", actual: snapshot.orphanAssignments });
  }
  if (snapshot.malformedScopes.length) {
    failures.push({ invariant: "scope_pair", actual: snapshot.malformedScopes });
  }
  if (snapshot.activeScopedAssignments.length) {
    failures.push({
      invariant: "active_role_scope",
      reason: "Backend lokal membaca role aktif sebagai global; assignment berscope belum didukung.",
      actual: snapshot.activeScopedAssignments,
    });
  }
  if (snapshot.duplicateAssignments.length) {
    failures.push({ invariant: "duplicate_assignments", actual: snapshot.duplicateAssignments });
  }

  return {
    ok: failures.length === 0,
    activeRoles: active,
    nonassignableRoles: inactive,
    permissionCounts: Object.fromEntries(ACTIVE_ROLES.map((role) => [role, actualPermissions[role]?.length ?? 0])),
    orphanAssignments: snapshot.orphanAssignments.length,
    malformedScopes: snapshot.malformedScopes.length,
    activeScopedAssignments: snapshot.activeScopedAssignments.length,
    duplicateAssignments: snapshot.duplicateAssignments.length,
    failures,
  };
}

export function createRbacVerificationEvidence(result, target = "local", now = new Date()) {
  if (!new Set(["local", "production"]).has(target)) {
    throw new Error("RBAC_VERIFY_TARGET wajib local atau production");
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error("Waktu evidence RBAC tidak valid");
  const finishedAt = now.toISOString();
  return {
    gate: "rbacVerification",
    target,
    status: result.ok ? "PASS" : "FAIL",
    finishedAt,
    expiresAt: new Date(now.getTime() + EVIDENCE_LIFETIME_MS).toISOString(),
    roles: result.activeRoles,
    permissionMismatchCount: result.failures.filter((failure) => failure.invariant === "role_permissions").length,
    orphanAssignmentCount: result.orphanAssignments,
    verification: result,
  };
}

export async function writeRbacVerificationEvidence(report, output) {
  if (!output) return null;
  if (!path.isAbsolute(output)) throw new Error("RBAC_VERIFY_OUTPUT wajib path absolut");
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  await rename(temporary, output);
  return output;
}

export async function collectRbacSnapshot(client) {
  const queries = [
    `select r.code, r.is_assignable,
      coalesce(array_agg(p.code order by p.code) filter (where p.code is not null), '{}') permissions
      from utero_academy.roles r
      left join utero_academy.role_permissions rp on rp.role_id = r.id
      left join utero_academy.permissions p on p.id = rp.permission_id
      group by r.code, r.is_assignable order by r.code`,
    `select ur.id, ur.user_id, ur.role_id
      from utero_academy.user_roles ur
      left join auth.users u on u.id = ur.user_id
      left join utero_academy.roles r on r.id = ur.role_id
      where u.id is null or r.id is null order by ur.id`,
    `select ur.id, r.code, ur.scope_type, ur.scope_id
      from utero_academy.user_roles ur join utero_academy.roles r on r.id = ur.role_id
      where (ur.scope_type is null) <> (ur.scope_id is null) order by ur.id`,
    `select ur.id, ur.user_id, r.code, ur.scope_type, ur.scope_id
      from utero_academy.user_roles ur join utero_academy.roles r on r.id = ur.role_id
      where r.is_assignable and (ur.scope_type is not null or ur.scope_id is not null) order by ur.id`,
    `select user_id, role_id, scope_type, scope_id, count(*)::int as count
      from utero_academy.user_roles
      group by user_id, role_id, scope_type, scope_id having count(*) > 1
      order by user_id, role_id`,
  ];
  const results = [];
  for (const query of queries) results.push(await client.query(query));
  const [roleResult, orphanResult, malformedResult, scopedResult, duplicateResult] = results;
  return {
    roles: roleResult.rows,
    orphanAssignments: orphanResult.rows,
    malformedScopes: malformedResult.rows,
    activeScopedAssignments: scopedResult.rows,
    duplicateAssignments: duplicateResult.rows,
  };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL wajib diisi");
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    await client.query("begin transaction read only");
    const result = verifyRbacSnapshot(await collectRbacSnapshot(client));
    await client.query("rollback");
    const report = createRbacVerificationEvidence(result, process.env.RBAC_VERIFY_TARGET?.trim() || "local");
    await writeRbacVerificationEvidence(report, process.env.RBAC_VERIFY_OUTPUT?.trim());
    console.log(JSON.stringify(report, null, 2));
    if (!result.ok) process.exitCode = 1;
  } finally {
    await client.query("rollback").catch(() => {});
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
