import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createSupabaseClient: vi.fn(),
  updateLocalApplication: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/guards", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/backend/server", () => ({ usesLocalBackend: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createUteroAcademyClient: mocks.createSupabaseClient }));
vi.mock("@/features/admin/local", () => ({
  updateLocalApplication: mocks.updateLocalApplication,
  approveLocalOnboarding: vi.fn(),
  createLocalPlacement: vi.fn(),
  deleteLocalPlacement: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { updateApplicationStatusAction } from "@/features/admin/actions";

describe("aksi status pendaftaran pada backend lokal", () => {
  it("tidak membuat client Supabase", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    mocks.createSupabaseClient.mockImplementation(() => { throw new Error("Supabase tidak tersedia"); });
    mocks.updateLocalApplication.mockResolvedValue(undefined);
    const form = new FormData();
    form.set("id", "22222222-2222-4222-8222-222222222222");
    form.set("status", "reviewed");

    await updateApplicationStatusAction(form);

    expect(mocks.createSupabaseClient).not.toHaveBeenCalled();
    expect(mocks.updateLocalApplication).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222", {
      status: "reviewed", startDate: undefined, endDate: undefined,
    });
  });
});
