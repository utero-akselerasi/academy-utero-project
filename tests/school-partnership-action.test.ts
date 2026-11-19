import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSuperAdmin: vi.fn(), backendRequest: vi.fn(), revalidatePath: vi.fn() }));

vi.mock("@/features/auth/guards", () => ({ requireSuperAdmin: mocks.requireSuperAdmin, requireAdmin: vi.fn(), requireUser: vi.fn() }));
vi.mock("@/lib/backend/server", () => ({ usesLocalBackend: () => true, backendRequest: mocks.backendRequest }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { updateSchoolPartnershipAction } from "@/features/super-admin/actions";

const schoolId = "22222222-2222-4222-8222-222222222222";
const initial = { ok: false, message: "" };

function form(code: string) {
  const data = new FormData();
  data.set("schoolId", schoolId);
  data.set("partnerStatus", "prospect");
  data.set("referralCode", code);
  data.set("referralQuota", "");
  data.set("referralExpiresAt", "");
  return data;
}

describe("updateSchoolPartnershipAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSuperAdmin.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    mocks.backendRequest.mockResolvedValue({ ok: true });
  });

  it("mengembalikan pesan validasi tanpa POST 500 untuk kode pendek", async () => {
    const result = await updateSchoolPartnershipAction(initial, form("ABC"));
    expect(result).toEqual({ ok: false, message: expect.stringContaining("6–32") });
    expect(mocks.backendRequest).not.toHaveBeenCalled();
  });

  it("menerima kode kosong berisi spasi", async () => {
    expect((await updateSchoolPartnershipAction(initial, form("   "))).ok).toBe(true);
    expect(mocks.backendRequest).toHaveBeenCalledWith(expect.stringContaining(schoolId), expect.objectContaining({
      body: expect.stringContaining('"referralCode":""'),
    }));
  });

  it("menormalkan kode dan menampilkan kegagalan backend tanpa exception", async () => {
    expect((await updateSchoolPartnershipAction(initial, form(" sekolah-1 "))).ok).toBe(true);
    expect(mocks.backendRequest).toHaveBeenCalledWith(expect.stringContaining(schoolId), expect.objectContaining({
      body: expect.stringContaining('"referralCode":"SEKOLAH-1"'),
    }));
    mocks.backendRequest.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: "invalid_partnership" }) });
    expect(await updateSchoolPartnershipAction(initial, form("SEKOLAH-1"))).toEqual({ ok: false, message: "Data kemitraan tidak valid." });
  });
});
