import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  backendRequest: vi.fn(), getUser: vi.fn(), validate: vi.fn(), revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/guards", () => ({ requireUser: mocks.getUser }));
vi.mock("@/lib/backend/server", () => ({ usesLocalBackend: () => true, backendRequest: mocks.backendRequest }));
vi.mock("@/lib/uploads", () => ({
  validateUpload: mocks.validate,
  buildStoragePath: () => "test-user/12345678-1234-4234-8234-123456789abc.png",
  UploadValidationError: class UploadValidationError extends Error {},
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

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
  mocks.backendRequest.mockImplementation(async (route: string) => ({
    ok: true, json: async () => route === "/v1/profile" ? { internProfile: { id: "intern-1" } } : {},
  }));
  mocks.validate.mockResolvedValue({ buffer: new Uint8Array([1]), contentType: "image/png", ext: "png" });
});

describe("updateProfileAction peserta", () => {
  it("menolak biodata kosong sebelum unggah atau update", async () => {
    const form = validForm();
    form.set("address", " ");
    expect((await updateProfileAction({ ok: false, message: "" }, form)).ok).toBe(false);
    expect(mocks.backendRequest).toHaveBeenCalledTimes(1);
    expect(mocks.backendRequest).toHaveBeenCalledWith("/v1/profile");
  });

  it("menghapus hanya avatar baru ketika update backend gagal", async () => {
    mocks.backendRequest.mockImplementation(async (route: string, options?: RequestInit) => ({
      ok: !(route === "/v1/profile" && options?.method === "PATCH"),
      status: 500,
      json: async () => ({ internProfile: { id: "intern-1" } }),
    }));
    expect((await updateProfileAction({ ok: false, message: "" }, validForm(true))).ok).toBe(false);
    expect(mocks.backendRequest).toHaveBeenCalledWith(
      "/v1/storage/academy-private/test-user/12345678-1234-4234-8234-123456789abc.png", { method: "DELETE" },
    );
    expect(mocks.backendRequest).not.toHaveBeenCalledWith(expect.stringContaining("old.png"), expect.anything());
  });

  it("menyimpan biodata lewat backend dan hanya mengunggah avatar baru", async () => {
    expect((await updateProfileAction({ ok: false, message: "" }, validForm(true))).ok).toBe(true);
    expect(mocks.backendRequest).toHaveBeenCalledWith("/v1/storage/academy-private", expect.objectContaining({
      method: "POST", headers: { "x-object-path": "test-user/12345678-1234-4234-8234-123456789abc.png" },
    }));
    expect(mocks.backendRequest).toHaveBeenCalledWith("/v1/profile", expect.objectContaining({
      method: "PATCH", body: expect.stringContaining('"avatarPath":"test-user/12345678-1234-4234-8234-123456789abc.png"'),
    }));
    expect(mocks.backendRequest).not.toHaveBeenCalledWith(expect.stringContaining("old.png"), expect.anything());
  });

  it("tidak mengaktifkan onboarding saat peserta menyimpan biodata", async () => {
    expect((await updateProfileAction({ ok: false, message: "" }, validForm())).ok).toBe(true);
    expect(mocks.backendRequest).toHaveBeenCalledWith("/v1/profile", expect.objectContaining({
      method: "PATCH", body: expect.not.stringContaining("onboarding_status"),
    }));
  });
});
