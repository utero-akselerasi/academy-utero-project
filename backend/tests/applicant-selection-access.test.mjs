import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../migrations/9026_applicant_selection_access.sql", import.meta.url), "utf8");
const registrationRoute = await readFile(new URL("../src/routes/registration.mjs", import.meta.url), "utf8");

test("participant access stays scoped to published, assigned tests and owned materials", () => {
  for (const table of ["packages", "materials", "questions", "options"]) {
    assert.match(migration, new RegExp(`create policy selection_${table}_applicant_select`));
  }
  assert.match(migration, /assignment\.package_id = selection_test_packages\.id/);
  assert.match(migration, /application\.applicant_user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /application\.selection_track_id = selection_materials\.track_id/);
  assert.match(migration, /package\.is_published/);
  assert.match(registrationRoute, /select id, question_type, prompt, points, order_index, is_required from utero_academy\.selection_questions/);
  assert.match(registrationRoute, /select id, question_id, label, content, order_index from utero_academy\.selection_question_options/);
});

test("only assigned applicant can advance own active attempt", () => {
  assert.match(migration, /security definer set search_path = ''/);
  assert.match(migration, /attempt\.applicant_user_id = auth\.uid\(\)/);
  assert.match(migration, /assignment\.status = 'assigned' and attempt\.status = 'in_progress'/);
  assert.match(migration, /assignment\.status = 'in_progress' and attempt\.status in \('grading', 'graded'\)/);
  assert.match(migration, /revoke all on function .* from public, anon/);
});
