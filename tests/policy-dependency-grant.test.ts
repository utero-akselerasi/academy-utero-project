import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0046_grant_school_contacts_policy_dependency.sql"),
  "utf8",
);

describe("policy dependency grants", () => {
  it("memberi authenticated akses baca ke school_contacts", () => {
    expect(migration).toMatch(
      /grant\s+select\s+on\s+table\s+utero_academy\.school_contacts\s+to\s+authenticated\s*;/i,
    );
  });
});
