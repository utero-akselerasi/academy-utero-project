import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0049_reassert_certificate_schema.sql"),
  "utf8",
);

describe("reassert certificate schema", () => {
  it("hanya menyentuh tabel certificates dan membentuk kontrak helper", () => {
    expect(migration).toMatch(/add column if not exists final_score numeric\(5,2\)/i);
    expect(migration).toMatch(/add column if not exists notes text/i);
    expect(migration).toMatch(/alter column assessment_id drop not null/i);
    expect(migration).toMatch(/add constraint certificates_assessment_or_course check/i);
    expect(migration).toMatch(/create unique index if not exists idx_certificates_intern_course_unique/i);
    expect(migration).not.toMatch(/\b(?:insert|update|delete|truncate)\b/i);
    expect(migration).not.toMatch(/\b(?:auth|storage)\./i);
  });

  it("gagal sebelum perubahan jika data buruk atau duplikat ditemukan", () => {
    const preflightEnd = migration.indexOf("alter table utero_academy.certificates");
    const badDataCheck = migration.indexOf("Data certificates melanggar certificates_assessment_or_course");
    const duplicateCheck = migration.indexOf("Data certificates memiliki duplikat intern_id/course_id");
    const badIndexCheck = migration.indexOf("Index idx_certificates_intern_course_unique ada dengan definisi tidak sesuai");
    expect(preflightEnd).toBeGreaterThan(0);
    expect(badDataCheck).toBeGreaterThan(0);
    expect(duplicateCheck).toBeGreaterThan(badDataCheck);
    expect(badIndexCheck).toBeGreaterThan(duplicateCheck);
    expect(badIndexCheck).toBeLessThan(preflightEnd);
    expect(migration).not.toContain("not valid");
  });

  it("mempertahankan XOR assessment/course dan unique index parsial", () => {
    expect(migration).toMatch(/certificate_type = 'assessment' and assessment_id is not null and course_id is null/i);
    expect(migration).toMatch(/certificate_type = 'course_completion' and course_id is not null and assessment_id is null/i);
    expect(migration).toMatch(/on utero_academy\.certificates \(intern_id, course_id\)\s+where course_id is not null/i);
  });
});
