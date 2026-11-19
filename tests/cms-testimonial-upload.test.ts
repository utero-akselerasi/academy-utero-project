import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  localCmsRequest: vi.fn(),
  validateUpload: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/guards", () => ({ requireAdmin: vi.fn(), requireUser: mocks.requireUser }));
vi.mock("@/lib/backend/server", () => ({ usesLocalBackend: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createUteroAcademyServiceRoleClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/uploads", () => ({
  UploadValidationError: class UploadValidationError extends Error {},
  validateUpload: mocks.validateUpload,
  buildStoragePath: () => "testimonial/44444444-4444-4444-8444-444444444444.png",
}));
vi.mock("@/features/cms/local-api", () => ({
  localCmsRequest: mocks.localCmsRequest,
  uploadLocalCmsFile: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { submitInternTestimonialAction } from "@/features/cms/actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({ id: "22222222-2222-4222-8222-222222222222" });
  mocks.validateUpload.mockResolvedValue({
    buffer: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    contentType: "image/png",
    ext: "png",
    displayName: "alumni.png",
  });
  mocks.localCmsRequest.mockResolvedValue({ item: { id: "testimonial-1" } });
});

describe("submitInternTestimonialAction backend lokal", () => {
  it("mengirim foto tervalidasi sebagai multipart dengan object path", async () => {
    const form = new FormData();
    form.set("siteId", "11111111-1111-4111-8111-111111111111");
    form.set("quote", "Program ini membantu saya berkembang.");
    form.set("photo", new File(["gambar"], "alumni.png", { type: "image/png" }));

    await submitInternTestimonialAction(form);

    expect(mocks.validateUpload).toHaveBeenCalledWith(expect.any(File), ["image"]);
    expect(mocks.localCmsRequest).toHaveBeenCalledOnce();
    const [endpoint, options] = mocks.localCmsRequest.mock.calls[0];
    expect(endpoint).toBe("/v1/cms/testimonials/intern");
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({ "x-object-path": "testimonial/44444444-4444-4444-8444-444444444444.png" });
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get("siteId")).toBe("11111111-1111-4111-8111-111111111111");
    expect(options.body.get("quote")).toBe("Program ini membantu saya berkembang.");
    expect(options.body.get("photo")).toBeInstanceOf(File);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/intern/certificate");
  });
});
