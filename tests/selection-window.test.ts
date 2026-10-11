import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApplicant: vi.fn(),
  getApplicantAttempt: vi.fn(),
  createDatabase: vi.fn(),
}));

vi.mock("@/features/auth/guards", () => ({ requireApplicant: mocks.requireApplicant }));
vi.mock("@/features/selection/applicant", () => ({ getApplicantAttempt: mocks.getApplicantAttempt }));
vi.mock("@/lib/supabase/server", () => ({
  createUteroAcademyServiceRoleClient: mocks.createDatabase,
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/uploads", () => ({ validateUpload: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveSelectionAnswerAction, submitSelectionAttemptAction } from "@/features/selection/applicant-actions";

const assignmentId = "11111111-1111-4111-8111-111111111111";
const questionId = "22222222-2222-4222-8222-222222222222";

function attemptData() {
  return {
    assignment: { id: assignmentId, package_id: "package-1", due_at: null, max_attempts: 1 },
    test: { available_from: null, available_until: new Date(Date.now() - 1000).toISOString() },
    attempt: { id: "attempt-1", status: "in_progress", expires_at: new Date(Date.now() + 60000).toISOString() },
    questions: [], options: [], answers: [], active: true,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApplicant.mockResolvedValue({ id: "applicant-1" });
  mocks.getApplicantAttempt.mockResolvedValue(attemptData());
});

describe("jendela paket tes pada server action", () => {
  it("menolak simpan jawaban setelah available_until sebelum akses database", async () => {
    const form = new FormData();
    form.set("assignmentId", assignmentId);
    form.set("questionId", questionId);
    await expect(saveSelectionAnswerAction(form)).rejects.toThrow("Tes sudah ditutup.");
    expect(mocks.createDatabase).not.toHaveBeenCalled();
  });

  it("menolak submit setelah available_until sebelum akses database", async () => {
    const form = new FormData();
    form.set("assignmentId", assignmentId);
    await expect(submitSelectionAttemptAction(form)).rejects.toThrow("Tes sudah ditutup.");
    expect(mocks.createDatabase).not.toHaveBeenCalled();
  });

  it("menolak save dan submit tepat pada available_until", async () => {
    const boundary = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(boundary);
    mocks.getApplicantAttempt.mockResolvedValue({
      ...attemptData(),
      test: { available_from: null, available_until: new Date(boundary).toISOString() },
    });
    const form = new FormData();
    form.set("assignmentId", assignmentId);
    form.set("questionId", questionId);
    try {
      await expect(saveSelectionAnswerAction(form)).rejects.toThrow("Tes sudah ditutup.");
      await expect(submitSelectionAttemptAction(form)).rejects.toThrow("Tes sudah ditutup.");
      expect(mocks.createDatabase).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
    }
  });

  it("menolak jawaban sebelum available_from", async () => {
    mocks.getApplicantAttempt.mockResolvedValue({
      ...attemptData(),
      test: { available_from: new Date(Date.now() + 60000).toISOString(), available_until: null },
    });
    const form = new FormData();
    form.set("assignmentId", assignmentId);
    form.set("questionId", questionId);
    await expect(saveSelectionAnswerAction(form)).rejects.toThrow("Tes belum dibuka.");
    await expect(submitSelectionAttemptAction(form)).rejects.toThrow("Tes belum dibuka.");
    expect(mocks.createDatabase).not.toHaveBeenCalled();
  });
});

describe("migrasi 0044", () => {
  const migration = readFileSync(join(import.meta.dirname, "..", "supabase", "migrations", "0044_enforce_selection_test_window.sql"), "utf8");

  it("memasang trigger sebelum insert atau update jawaban", () => {
    expect(migration).toMatch(/before insert or update on utero_academy\.selection_answers/i);
    expect(migration).toMatch(/execute function utero_academy\.enforce_selection_answer_deadline\(\)/i);
  });

  it("mengambil jendela paket dan menolak sebelum atau sesudah jendela", () => {
    expect(migration).toMatch(/package\.available_from, package\.available_until/i);
    expect(migration).toMatch(/checked_at < test_available_from/i);
    expect(migration).toMatch(/checked_at >= test_available_until/i);
    expect(migration).toContain("Tes belum dibuka");
    expect(migration).toContain("Tes sudah ditutup");
  });

  it("tetap memverifikasi attempt aktif, expiry, deadline, dan paket soal", () => {
    expect(migration).toMatch(/attempt_row\.status::text <> 'in_progress'/i);
    expect(migration).toMatch(/checked_at >= attempt_row\.expires_at/i);
    expect(migration).toMatch(/checked_at >= assignment_deadline/i);
    expect(migration).toMatch(/question\.id = new\.question_id/i);
  });
});
