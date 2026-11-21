import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../migrations/9027_selection_answer_rls_lock.sql", import.meta.url), "utf8");

test("answer deadline trigger reads RLS-scoped assignment without locking inaccessible rows", () => {
  assert.match(migration, /security invoker set search_path = ''/);
  assert.match(migration, /where assignment\.id = attempt_row\.assignment_id;/);
  assert.doesNotMatch(migration, /for share of assignment, package/i);
  assert.match(migration, /where attempt\.id = new\.attempt_id for update;/);
  assert.match(migration, /revoke all on function .* from public, anon, authenticated/);
});