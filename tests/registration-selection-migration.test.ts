import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/0039_registration_selection_system.sql"),
  "utf8",
);

describe("registration and selection migration contract", () => {
  it("adds applicant role without granting intern role", () => {
    expect(migration).toContain("values ('applicant', 'Applicant'");
    expect(migration).not.toMatch(/values\s*\(\s*'intern'/i);
  });

  it("provisions applicant identity only for applicant signup metadata", () => {
    expect(migration).toContain("provision_applicant_user");
    expect(migration).toContain("utero_academy_applicant");
    expect(migration).toContain("after insert on auth.users");
    expect(migration).toContain("add column if not exists is_assignable");
  });

  it.each([
    "selection_tracks",
    "selection_materials",
    "selection_test_packages",
    "selection_questions",
    "selection_question_options",
    "selection_assignments",
    "selection_attempts",
    "selection_answers",
    "selection_grades",
    "selection_decisions",
    "selection_bypasses",
    "application_document_requirements",
    "application_documents",
    "application_notifications",
  ])("creates %s", (table) => {
    expect(migration).toContain(`create table if not exists utero_academy.${table}`);
  });

  it("keeps bypass behind a super-admin checked function", () => {
    expect(migration).toContain("current_user_has_role('super_admin')");
    expect(migration).toContain("revoke all on table utero_academy.selection_bypasses from anon, authenticated");
    expect(migration).toContain("security definer set search_path = ''");
  });

  it("exposes only public decision fields to applicants and schools", () => {
    expect(migration).toContain("visible_selection_results");
    expect(migration).toContain("public_note text");
    expect(migration).toContain("drop policy if exists selection_decisions_participant_select");
  });

  it("defines applicant and school ownership policies", () => {
    expect(migration).toContain("applicant_user_id = (select auth.uid())");
    expect(migration).toContain("school_id in (select utero_academy.current_user_school_ids())");
  });

  it("requires an authenticated applicant before application submission", () => {
    expect(migration).toContain("internship_applications_applicant_insert");
    expect(migration).not.toContain("create policy internship_applications_public_insert");
  });

  it("never exposes answer keys or correct choices through table grants", () => {
    expect(migration).toContain("revoke select on table utero_academy.selection_questions, utero_academy.selection_question_options from authenticated");
    expect(migration).toContain("grant select (id, package_id, question_type, prompt, points, order_index, is_required)");
    expect(migration).toContain("grant select (id, question_id, label, content, order_index)");
  });

  it("converts accepted applicants atomically and queues notifications", () => {
    expect(migration).toContain("accept_application_as_intern");
    expect(migration).toContain("selection_status::text not in ('passed', 'bypassed')");
    expect(migration).toContain("enqueue_selection_decision_notification");
  });

  it("supports waitlisted as an assignment and application selection status", () => {
    expect(migration).toContain("'passed', 'failed', 'waitlisted', 'expired'");
  });

  it("protects workflow fields and keeps decisions append-only", () => {
    expect(migration).toContain("protect_application_workflow_fields");
    expect(migration).toContain("selection_decisions_staff_insert");
    expect(migration).not.toContain("selection_decisions_staff_all");
  });
});
