import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0047_isolate_academy_storage_bucket.sql"),
  "utf8",
);

describe("isolasi Storage Academy", () => {
  it("membuat bucket privat tanpa memodifikasi bucket atau policy host bersama", () => {
    expect(migration).toMatch(/'academy-private',\s*'academy-private',\s*false,\s*20971520/i);
    expect(migration).toMatch(/on conflict \(id\) do nothing/i);
    expect(migration).not.toMatch(/(?:update|delete)\s+storage\.buckets|(?:drop|create|alter)\s+policy/i);
    expect(migration).not.toMatch(/'avatars'/i);
  });

  it("memeriksa scope nyata setiap policy publik tanpa bergantung nama", () => {
    expect(migration).toContain("roles::text[] && array['anon', 'authenticated', 'public']");
    expect(migration).toContain("coalesce(with_check, qual)");
    expect(migration).toContain("using_expression is null");
    expect(migration).toContain("check_expression is null");
    expect(migration).toContain("lower(expression) like '%academy-private%'");
    expect(migration).toContain("expression !~*");
    expect(migration).toContain("(?s)^(\\(bucket_id =");
    expect(migration).not.toContain("^\\(*[[:space:]]*bucket_id");
    expect(migration).not.toContain("policyname = 'Public Access'");
    expect(migration).toContain("scope-nya tidak dapat dibuktikan aman");
  });
});
