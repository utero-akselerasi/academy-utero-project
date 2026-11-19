import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ backendRequest: vi.fn(), createClient: vi.fn() }));

vi.mock("@/lib/backend/server", () => ({
  usesLocalBackend: () => true,
  backendRequest: mocks.backendRequest,
}));
vi.mock("@/lib/supabase/server", () => ({ createUteroAcademyServiceRoleClient: mocks.createClient }));

const { writeAuditLog } = await import("../features/super-admin/audit");

describe("writeAuditLog backend lokal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mengirim audit ke backend tanpa membuat client Supabase", async () => {
    mocks.backendRequest.mockResolvedValue({ ok: true, status: 204 });
    await writeAuditLog("actor-yang-tidak-dipercaya", "attendance.export", "attendances", null, null, null, { rows: 3 });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.backendRequest).toHaveBeenCalledWith("/v1/super-admin/audit-logs", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ action: "attendance.export", resourceType: "attendances", resourceId: null, previousValue: null, nextValue: null, metadata: { rows: 3 } }),
    }));
  });
});
