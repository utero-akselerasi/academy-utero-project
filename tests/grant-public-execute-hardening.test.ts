import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0051_harden_academy_public_execute.sql"),
  "utf8",
);

const signatures = [
  "award_points(uuid,integer,character varying,uuid,text)",
  "can_attempt_quiz(uuid,uuid)",
  "check_and_award_badges(uuid,character varying)",
  "current_user_has_role(text)",
  "set_announcement_published_at()",
  "set_updated_at()",
  "update_daily_activity(uuid,character varying,integer,integer)",
  "update_updated_at_column()",
  "update_user_streak(uuid)",
];

describe("0051 Academy PUBLIC EXECUTE hardening", () => {
  it("mencakup tepat sembilan signature hasil audit", () => {
    for (const signature of signatures)
      expect(migration).toContain(`utero_academy.${signature}`);
    expect(new Set(signatures).size).toBe(9);
  });

  it("mencabut PUBLIC dan seluruh app role sebelum explicit grant", () => {
    expect(migration).toMatch(/revoke execute on function[\s\S]+from public, anon, authenticated, service_role;/i);
    expect(migration).not.toMatch(/grant execute[^;]+to public/i);
    expect(migration).not.toMatch(/grant execute[^;]+to anon/i);
  });

  it("mempertahankan hanya dependency RLS authenticated", () => {
    expect(migration).toContain("grant execute on function utero_academy.current_user_has_role(text) to authenticated;");
    for (const signature of signatures.filter((value) => value !== "current_user_has_role(text)"))
      expect(migration).not.toContain(`grant execute on function utero_academy.${signature} to authenticated;`);
  });

  it("memberi service role hanya tiga RPC yang dipanggil aplikasi", () => {
    for (const signature of [
      "can_attempt_quiz(uuid,uuid)",
      "update_daily_activity(uuid,character varying,integer,integer)",
      "update_user_streak(uuid)",
    ]) expect(migration).toMatch(new RegExp(`utero_academy\\.${signature.replace(/[()]/g, "\\$&")}`));
    expect(migration).not.toMatch(/grant execute[\s\S]+award_points[\s\S]+to service_role;/i);
    expect(migration).not.toMatch(/grant execute[\s\S]+check_and_award_badges[\s\S]+to service_role;/i);
  });

  it("menambahkan privilege tabel minimum untuk dua RPC mutasi", () => {
    expect(migration).toMatch(/grant insert, update on table[\s\S]+utero_academy\.daily_activity,[\s\S]+utero_academy\.user_streaks[\s\S]+to service_role;/i);
    expect(migration).not.toMatch(/grant[^;]+(?:delete|truncate|references|trigger)[^;]+to service_role/i);
  });

  it("gagal tertutup pada owner, security mode, search_path, RLS, policy, dan trigger", () => {
    expect(migration).toContain("pg_get_userbyid(p.proowner) = schema_owner");
    expect(migration).toContain("p.prosecdef = target.security_definer");
    expect(migration).toContain("search_path=utero_academy, public, pg_temp");
    expect(migration).toContain("c.relrowsecurity");
    expect(migration).toContain("roles = array['authenticated']::name[]");
    expect(migration).toContain("from pg_trigger t");
    expect(migration).toContain("0051 PUBLIC EXECUTE masih ada");
  });

  it("tetap production-deployable tanpa guard nama DB atau tracker clone", () => {
    expect(migration).not.toMatch(/current_database|schema_migrations|disposable|0038|0048/i);
  });
});
