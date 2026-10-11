import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/0043_atomic_selection_decision_and_acceptance.sql"),
  "utf8",
);

describe("atomic selection decision and acceptance migration", () => {
  it("keeps selection decisions inside one privileged RPC transaction", () => {
    expect(migration).toContain("decide_selection_atomically");
    expect(migration).toContain("language plpgsql security definer set search_path = ''");
    expect(migration).toContain("current_user_has_role('admin')");
    expect(migration).toContain("current_user_has_role('super_admin')");
    expect(migration).toContain("update utero_academy.selection_assignments set status");
    expect(migration).toContain("update utero_academy.internship_applications set selection_status");
    expect(migration).toContain("insert into utero_academy.audit_logs");
  });

  it("upserts the decision for the same graded attempt", () => {
    expect(migration).toMatch(/where attempt_id = attempt_row\.id[\s\S]*for update/i);
    expect(migration).toMatch(/if decision_id is null then[\s\S]*insert into utero_academy\.selection_decisions[\s\S]*else[\s\S]*update utero_academy\.selection_decisions/i);
  });

  it("serializes acceptance by user and preserves same-application retries", () => {
    expect(migration).toContain("from auth.users where id = application_row.applicant_user_id for update");
    expect(migration).toContain("return application_row.converted_intern_id");
    expect(migration).toContain("other_application.id <> p_application_id");
    expect(migration).toContain("Pengguna sudah memiliki penempatan magang aktif");
    expect(migration).toContain("profile.status::text in ('pending', 'active', 'paused')");
  });

  it("exposes both RPCs only to authenticated callers", () => {
    expect(migration).toContain("revoke all on function utero_academy.decide_selection_atomically");
    expect(migration).toContain("grant execute on function utero_academy.decide_selection_atomically");
    expect(migration).toContain("revoke all on function utero_academy.accept_application_as_intern(uuid,date,date) from public, anon, authenticated");
    expect(migration).toContain("grant execute on function utero_academy.accept_application_as_intern(uuid,date,date) to authenticated");
  });
});
