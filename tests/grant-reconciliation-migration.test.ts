import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0050_reconcile_phase13_explicit_grants.sql"),
  "utf8",
);

describe("0050 explicit grant reconciliation", () => {
  it("tetap deployable dan tidak mengunci nama DB atau tracker clone", () => {
    expect(migration).not.toMatch(/current_database|phase13_grants_0050_disposable|schema_migrations|0038|0048/i);
    expect(migration).toContain("schema_owner name");
    expect(migration).toContain("pg_has_role(current_user, schema_owner, 'USAGE')");
  });

  it("menolak blanket/default/anon grant", () => {
    expect(migration).not.toMatch(/all privileges|all tables|all functions|all sequences/i);
    expect(migration).not.toMatch(/alter default privileges/i);
    expect(migration).not.toMatch(/\bgrant\b[^;]+\bto anon\b/i);
    expect(migration).not.toMatch(/\bgrant\s+(?:truncate|references|trigger)\b/i);
  });

  it("mengembalikan hanya allowlist authenticated yang dibuktikan hilang", () => {
    expect(migration).toMatch(/grant select, insert, update on table utero_academy\.attendances to authenticated/i);
    expect(migration).toMatch(/grant select, insert, delete on table utero_academy\.mentor_assignments to authenticated/i);
    expect(migration).toMatch(/grant select, update on table utero_academy\.mentor_profiles to authenticated/i);
    for (const table of ["intern_profiles", "roles", "user_profiles", "user_roles"])
      expect(migration).toContain(`grant select on table utero_academy.${table} to authenticated;`);
  });

  it("membatasi service role pada operasi call-site, bukan 91 objek clean", () => {
    expect(migration).toMatch(/grant insert, select on table[\s\S]+utero_academy\.certificates[\s\S]+to service_role;/i);
    expect(migration).toMatch(/grant delete, insert, select on table[\s\S]+utero_academy\.user_roles[\s\S]+to service_role;/i);
    expect(migration).toMatch(/grant select on table[\s\S]+utero_academy\.application_notifications[\s\S]+to service_role;/i);
    expect(migration).not.toMatch(/grant[^;]+(?:truncate|references|trigger)[^;]+to service_role/i);
    expect(migration).not.toContain("utero_academy.schema_migrations");
    expect(migration).not.toContain("utero_academy.storage_path_backfill_snapshot");
  });

  it("memberi execute hanya pada lima RPC service client", () => {
    for (const name of ["bypass_selection", "can_attempt_quiz", "decide_selection_atomically", "update_daily_activity", "update_user_streak"])
      expect(migration).toMatch(new RegExp(`utero_academy\\.${name}\\(`, "i"));
    for (const internal of ["enforce_application_selection_transition", "protect_application_workflow_fields", "provision_applicant_user"])
      expect(migration).not.toContain(`utero_academy.${internal}`);
  });

  it("gagal tertutup pada owner, RLS, signature, dan grant tidak efektif", () => {
    expect(migration).toContain("pg_get_userbyid(c.relowner) = schema_owner");
    expect(migration).toContain("target.expected_kind = 'v' or c.relrowsecurity");
    expect(migration).toContain("pg_get_userbyid(p.proowner) = schema_owner");
    expect(migration).toContain("has_table_privilege");
    expect(migration).toContain("has_function_privilege");
    expect(migration).toContain("has_schema_privilege");
  });
});
