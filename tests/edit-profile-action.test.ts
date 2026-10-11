import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), update: vi.fn(), remove: vi.fn(), upload: vi.fn(),
  read: vi.fn(), domainUpdate: vi.fn(), getUser: vi.fn(), hasRole: vi.fn(), validate: vi.fn(),
}));

vi.mock("@/features/auth/guards", () => ({ requireUser: mocks.getUser }));
vi.mock("@/features/auth/roles", () => ({ userHasAnyRole: mocks.hasRole }));
vi.mock("@/lib/supabase/server", () => ({
  createUteroAcademyServiceRoleClient: async () => ({ from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: mocks.read }) }),
    update: () => ({ eq: () => ({ not: mocks.domainUpdate, then: (resolve: (value: unknown) => unknown) => resolve({ error: null }) }) }),
  }) }),
  createUteroAcademyClient: async () => ({ rpc: mocks.rpc, from: () => ({
    update: mocks.update,
  }) }),
  createSupabaseServiceRoleClient: () => ({ storage: { from: () => ({
    upload: mocks.upload, remove: mocks.remove,
  }) } }),
}));
vi.mock("@/lib/uploads", () => ({
  validateUpload: mocks.validate,
  buildStoragePath: () => "test-user/12345678-1234-4234-8234-123456789abc.png",
  UploadValidationError: class UploadValidationError extends Error {},
}));
vi.mock("@/lib/storage-urls", () => ({ toObjectPath: (path: string | null) => path }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateProfileAction } from "@/features/auth/edit-profile-action";

function validForm(withAvatar = false) {
  const form = new FormData();
  for (const [name, value] of Object.entries({
    fullName: "Sari", phone: "081234567890", major: "RPL", gradeOrSemester: "XII",
    schoolName: "SMK Utero", address: "Jalan Contoh 10", schoolSupervisorName: "Ibu Guru",
    schoolSupervisorPhone: "081234567891", emergencyContactName: "", emergencyContactPhone: "",
  })) form.set(name, value);
  if (withAvatar) form.set("avatar", new File(["image"], "photo.png", { type: "image/png" }));
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ id: "test-user", email: "sari@example.com" });
  mocks.read.mockResolvedValueOnce({ data: { avatar_path: "test-user/old.png" }, error: null })
    .mockResolvedValueOnce({ data: { id: "intern-1" }, error: null })
    .mockResolvedValueOnce({ data: null, error: null });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.domainUpdate.mockResolvedValue({ error: null });
  mocks.validate.mockResolvedValue({ buffer: new Uint8Array([1]), contentType: "image/png", ext: "png" });
});

describe("updateProfileAction peserta", () => {
  it("menolak biodata kosong tanpa unggah dan tanpa update", async () => {
    const form = validForm();
    form.set("address", " ");
    expect((await updateProfileAction({ ok: false, message: "" }, form)).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("gagal atomik ketika RPC gagal dan membuang avatar baru", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "database unavailable" } });
    const result = await updateProfileAction({ ok: false, message: "" }, validForm(true));
    expect(result.ok).toBe(false);
    expect(mocks.remove).toHaveBeenCalledWith(["test-user/12345678-1234-4234-8234-123456789abc.png"]);
    expect(mocks.remove).not.toHaveBeenCalledWith(["test-user/old.png"]);
  });

  it("menyimpan lewat RPC dan membersihkan avatar lama sesudah sukses", async () => {
    const result = await updateProfileAction({ ok: false, message: "" }, validForm(true));
    expect(result.ok).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("update_own_intern_biodata", expect.objectContaining({
      p_full_name: "Sari", p_school_name: "SMK Utero", p_avatar_path: "test-user/12345678-1234-4234-8234-123456789abc.png",
    }));
    expect(mocks.remove).toHaveBeenCalledWith(["test-user/old.png"]);
  });

  it("tidak mengaktifkan onboarding saat peserta menyimpan biodata", async () => {
    mocks.read.mockReset();
    mocks.read.mockResolvedValueOnce({ data: { avatar_path: null }, error: null })
      .mockResolvedValueOnce({ data: { id: "intern-1", status: "pending", start_date: "2020-01-01", end_date: "2099-01-01" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    expect((await updateProfileAction({ ok: false, message: "" }, validForm())).ok).toBe(true);
    expect(mocks.domainUpdate).not.toHaveBeenCalled();
  });
});
