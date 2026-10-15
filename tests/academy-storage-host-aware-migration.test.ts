import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0048_academy_storage_host_aware_hardening.sql"),
  "utf8",
);

describe("pengganti Storage host-aware", () => {
  it("hanya memverifikasi Academy tanpa mengubah bucket, grant, atau policy host", () => {
    expect(migration).toMatch(/where id = 'academy-private'/i);
    expect(migration).toMatch(/academy_bucket\.public is distinct from false/i);
    expect(migration).toMatch(/academy_bucket\.file_size_limit is distinct from 20971520/i);
    expect(migration).not.toMatch(/\b(?:insert|update|delete|alter|drop|create|revoke|grant)\s+(?:into\s+|table\s+|policy\s+|on\s+)?storage\./i);
    expect(migration).not.toMatch(/where id in \(/i);
  });

  it("gagal tertutup jika RLS mati atau scope policy tidak terbukti aman", () => {
    expect(migration).toContain("relrowsecurity");
    expect(migration).toContain("roles::text[] && array['anon', 'authenticated', 'public']");
    expect(migration).toContain("coalesce(with_check, qual)");
    expect(migration).toContain("using_expression is null");
    expect(migration).toContain("check_expression is null");
    expect(migration).toContain("lower(expression) like '%academy-private%'");
    expect(migration).toContain("expression !~*");
    expect(migration).toContain("(?s)^(\\(bucket_id =");
    expect(migration).not.toContain("^\\(*[[:space:]]*bucket_id");
    expect(migration).not.toContain("policyname in ('Public Access'");
    expect(migration).toMatch(/if unsafe_policy is not null then\s+raise exception/i);
  });
});
