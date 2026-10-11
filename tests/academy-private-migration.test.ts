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

  it("menolak pembuatan saat policy Storage global masih terbuka", () => {
    expect(migration).toContain("policyname = 'Public Access'");
    expect(migration).toContain("trim(qual) = 'true'");
    expect(migration).toContain("raise exception 'Policy Storage global masih terbuka");
  });
});
