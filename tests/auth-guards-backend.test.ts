import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBackendIdentity: vi.fn(),
  userHasAnyRole: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
}));

vi.mock("@/lib/backend/server", () => ({ usesLocalBackend: () => true, getBackendIdentity: mocks.getBackendIdentity }));
vi.mock("@/features/auth/roles", () => ({ userHasAnyRole: mocks.userHasAnyRole }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { requireRole } from "@/features/auth/guards";

describe("backend role guard", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("uses roles already checked by the session endpoint", async () => {
    mocks.getBackendIdentity.mockResolvedValue({ id: "user-id", email: "user@example.com", roles: ["super_admin", "applicant"] });
    await expect(requireRole(["super_admin"])).resolves.toEqual({ id: "user-id", email: "user@example.com", roleCodes: ["super_admin", "applicant"] });
    expect(mocks.userHasAnyRole).not.toHaveBeenCalled();
  });

  it("rejects missing sessions and unauthorized roles", async () => {
    mocks.getBackendIdentity.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "user-id", email: null, roles: ["applicant"] });
    await expect(requireRole(["admin"])).rejects.toThrow("redirect:/login");
    await expect(requireRole(["admin"])).rejects.toThrow("redirect:/dashboard/forbidden");
  });
});
