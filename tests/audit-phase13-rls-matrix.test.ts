import { describe, expect, it } from "vitest";
import { assessRlsMatrix, validateRlsTarget } from "../scripts/audit-phase13-rls-matrix.mjs";

const principals = {
  anon: { academyAccess: "denied" }, peserta: { own: "passed", crossTenant: "denied" },
  sekolah: { own: "passed", crossTenant: "denied" }, mentorArea: { databaseRole: "admin", staffRead: "passed" },
  admin: { staffRead: "passed" }, superAdmin: { staffRead: "passed" },
  profileIsolation: { own: "passed", foreign: "denied" },
  roleIsolation: { own: "passed", foreign: "denied" },
  directRoleWrite: "denied", serviceRoleGrant: "passed",
};

describe("phase13 RLS matrix", () => {
  it("membatasi koneksi ke clone 0051 lokal", () => {
    expect(validateRlsTarget("postgresql://supabase_admin:secret@127.0.0.1:55439/phase13_public_exec_0051_disposable_20261013",
      "phase13_public_exec_0051_disposable_20261013")).toContain("127.0.0.1:55439");
    expect(() => validateRlsTarget("postgresql://supabase_admin:secret@20.20.20.3:5432/phase13_public_exec_0051_disposable_20261013",
      "phase13_public_exec_0051_disposable_20261013")).toThrow();
    expect(() => validateRlsTarget("postgresql://supabase_admin:secret@127.0.0.1:55439/phase13_current_prod",
      "phase13_current_prod")).toThrow();
    expect(validateRlsTarget("postgresql://supabase_admin:secret@127.0.0.1:55439/phase13_live_dev_candidate53_20261013",
      "phase13_live_dev_candidate53_20261013")).toContain("127.0.0.1:55439");
    expect(validateRlsTarget("postgresql://supabase_admin:secret@127.0.0.1:55439/phase13_live_prod_20261014",
      "phase13_live_prod_20261014")).toContain("127.0.0.1:55439");
  });

  it("menolak cross-tenant dan mentor role lama", () => {
    expect(assessRlsMatrix(principals).ready).toBe(true);
    expect(assessRlsMatrix({ ...principals, peserta: { own: "passed", crossTenant: "leaked" } }).ready).toBe(false);
    expect(assessRlsMatrix({ ...principals, mentorArea: { databaseRole: "mentor", staffRead: "passed" } }).ready).toBe(false);
    expect(assessRlsMatrix({ ...principals, roleIsolation: { own: "passed", foreign: "leaked" } }).ready).toBe(false);
    expect(assessRlsMatrix({ ...principals, directRoleWrite: "allowed" }).ready).toBe(false);
  });
});
