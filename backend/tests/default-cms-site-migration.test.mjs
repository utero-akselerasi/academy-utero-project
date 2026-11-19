import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

test("default CMS site is seeded by backend migration without replacing existing content", () => {
  const sql = readFileSync(path.resolve(import.meta.dirname, "../migrations/9023_seed_default_cms_site.sql"), "utf8");
  assert.match(sql, /insert into utero_academy\.cms_sites\s*\(name, slug, domain\)/i);
  assert.match(sql, /'utero-academy'/);
  assert.match(sql, /on conflict \(slug\) do nothing/i);
});
