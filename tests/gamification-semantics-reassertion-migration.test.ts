import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const directory = resolve(process.cwd(), "supabase/migrations");
const original = readFileSync(resolve(directory, "0036_fix_check_and_award_badges.sql"), "utf8");
const migration = readFileSync(resolve(directory, "0052_reassert_gamification_function_semantics.sql"), "utf8");

function definition(source: string, functionName: string) {
  const start = source.indexOf("create or replace function utero_academy." + functionName + "(");
  const end = source.indexOf("$$;", start);
  if (start < 0 || end < 0) throw new Error(functionName + " tidak ditemukan");
  return source.slice(start, end + 3).split(/\r?\n/).filter((line) => !/^\s*--/.test(line)).join("\n").replace(/\s+/g, " ").trim();
}

describe("0052 reassert gamification semantics", () => {
  it("menyalin kedua body canonical 0036 tanpa kehilangan search_path", () => {
    for (const name of ["award_points", "check_and_award_badges"]) {
      expect(definition(migration, name)).toBe(definition(original, name));
    }
    expect(migration).toContain("set search_path = utero_academy, public, pg_temp");
  });

  it("menolak akses app sebelum dan sesudah replace", () => {
    expect(migration).toContain("0052 wajib dijalankan setelah hardening 0051");
    expect(migration).toContain("from public, anon, authenticated, service_role;");
    expect(migration).toContain("0052 EXECUTE app role terbuka kembali");
    expect(migration).not.toMatch(/grant execute/i);
  });

  it("memeriksa owner dan marker kedua semantic drift", () => {
    expect(migration).toContain("pg_get_userbyid(p.proowner) = schema_owner");
    expect(migration).toContain("select total_points into v_new_total");
    expect(migration).toContain("get diagnostics v_inserted = row_count");
    expect(migration).toContain("intern_id = v_intern_id and completed_at is not null");
  });
});
