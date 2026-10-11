import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0045_allow_trusted_application_workflows.sql"),
  "utf8",
);

describe("trusted application workflow migration", () => {
  it("allows trusted RPC owners while preserving forged-state checks", () => {
    expect(migration).toContain("'supabase_admin'");
    expect(migration).not.toContain("current_user_has_role('admin')");
    expect(migration).toContain("new.selection_status::text <> 'not_assigned'");
    expect(migration).toContain("new.selection_status is distinct from old.selection_status");
  });

  it("does not restore direct write grants", () => {
    expect(migration).not.toMatch(/grant\s+(insert|update)/i);
    expect(migration).toContain("revoke all on function utero_academy.enforce_application_selection_transition()");
  });
});
