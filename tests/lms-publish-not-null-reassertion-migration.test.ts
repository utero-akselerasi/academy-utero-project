import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0053_reassert_lms_publish_not_null.sql"),
  "utf8",
);

describe("reassert LMS publish NOT NULL", () => {
  it("backfill NULL ke true, kunci tiga tabel, dan cek postcondition", () => {
    expect(migration).toContain("array['lessons', 'quizzes', 'assignments']");
    expect(migration).toContain("set is_published = true where is_published is null");
    expect(migration).toContain("alter column is_published set not null");
    expect(migration).toContain("alter column is_published set default true");
    expect(migration).toContain("Postcondition is_published NOT NULL/DEFAULT true gagal");
    expect(migration).toContain("column_default is distinct from 'true'");
    expect(migration).not.toMatch(/\b(?:auth|storage|soundpub|buzzerhood)\./i);
  });
});
