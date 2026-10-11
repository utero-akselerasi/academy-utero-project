import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/0041_lock_selection_application_transitions.sql"),
  "utf8",
);

describe("selection security migration contract", () => {
  it("removes direct application inserts and broad updates", () => {
    expect(migration).toContain("revoke insert on table utero_academy.internship_applications from anon, authenticated");
    expect(migration).toContain("revoke update on table utero_academy.internship_applications from anon, authenticated");
    expect(migration).toContain("grant update (status, reviewed_by, reviewed_at, updated_at)");
    expect(migration).not.toMatch(/grant update \([^)]*selection_status/i);
  });

  it("rejects forged insert state and direct selection transitions", () => {
    expect(migration).toContain("enforce_application_selection_transition");
    expect(migration).toContain("before insert or update on utero_academy.internship_applications");
    expect(migration).toContain("new.selection_status::text <> 'not_assigned'");
    expect(migration).toContain("new.onboarding_status::text <> 'not_started'");
    expect(migration).toContain("new.selection_status is distinct from old.selection_status");
  });

  it("allows trusted definer and service contexts through trigger", () => {
    expect(migration).toContain("current_user in ('postgres', 'service_role')");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("revoke all on function utero_academy.enforce_application_selection_transition()");
  });

  it("rejects suspended schools while preserving authenticated result RPC", () => {
    expect(migration).toMatch(/visible_selection_results[\s\S]*security definer/i);
    expect(migration).toContain("join utero_academy.schools school on school.id = contact.school_id");
    expect(migration).toContain("school.partner_status in ('verified', 'active_partner')");
    expect(migration).toContain("revoke all on function utero_academy.visible_selection_results(uuid)");
    expect(migration).toContain("grant execute on function utero_academy.visible_selection_results(uuid)");
  });
});
