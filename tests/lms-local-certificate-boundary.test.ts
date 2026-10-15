import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  backendRequest: vi.fn(),
  generateCourseCertificate: vi.fn(),
  revalidatePath: vi.fn(),
  requireUser: vi.fn(),
  supabaseClient: vi.fn(),
}));

vi.mock("@/lib/backend/server", () => ({
  backendRequest: mocks.backendRequest,
  usesLocalBackend: () => true,
}));
vi.mock("@/features/auth/guards", () => ({ requireAdmin: vi.fn(), requireUser: mocks.requireUser }));
vi.mock("@/features/auth/roles", () => ({ getUserRoleCodes: vi.fn() }));
vi.mock("@/features/auth/scope", () => ({ resolveStaffInternScope: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createUteroAcademyServiceRoleClient: mocks.supabaseClient,
  createSupabaseServiceRoleClient: mocks.supabaseClient,
}));
vi.mock("@/lib/uploads", () => ({
  UploadValidationError: class UploadValidationError extends Error {},
  buildStoragePath: vi.fn(),
  validateUpload: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/features/intern/activation", () => ({ requireActiveInternProfile: vi.fn() }));
vi.mock("@/features/lms/queries", () => ({ internIsEnrolled: vi.fn() }));
vi.mock("@/features/lms/certificate-helper", () => ({ generateCourseCertificate: mocks.generateCourseCertificate }));

import { markLessonCompletedAction } from "@/features/lms/actions";

describe("sertifikat LMS pada local backend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    mocks.backendRequest.mockResolvedValue(new Response(JSON.stringify({
      lessonId: "22222222-2222-4222-8222-222222222222",
      courseId: "33333333-3333-4333-8333-333333333333",
    }), { status: 200 }));
  });

  it("menyerahkan completion dan penerbitan sertifikat ke backend lokal", async () => {
    const form = new FormData();
    form.set("lessonId", "22222222-2222-4222-8222-222222222222");

    await markLessonCompletedAction(form);

    expect(mocks.backendRequest).toHaveBeenCalledWith(
      "/v1/lms/lessons/22222222-2222-4222-8222-222222222222/progress",
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
    );
    expect(mocks.generateCourseCertificate).not.toHaveBeenCalled();
    expect(mocks.supabaseClient).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/intern/lms/33333333-3333-4333-8333-333333333333");
  });
});
