import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), rpc: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/features/auth/guards", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createUteroAcademyClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { approveApplicationOnboardingAction } from "@/features/admin/actions";

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/0042_approve_application_onboarding.sql"),
  "utf8",
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
  mocks.rpc.mockResolvedValue({ error: null });
});

describe("approval onboarding admin", () => {
  it("membatasi RPC, memvalidasi profil dan periode, lalu menulis audit", () => {
    expect(migration).toContain("current_user_has_role('admin')");
    expect(migration).toContain("current_user_has_role('super_admin')");
    expect(migration).toContain("application_row.converted_intern_id");
    expect(migration).toContain("intern_row.start_date is distinct from application_row.approved_start_date");
    expect(migration).toContain("Biodata peserta belum lengkap");
    expect(migration).toContain("set onboarding_status = 'waiting_start', reviewed_by = auth.uid()");
    expect(migration).toContain("'approve_application_onboarding'");
    expect(migration).toContain("security definer set search_path = ''");
    expect(migration).toContain("revoke all on function utero_academy.approve_application_onboarding(uuid)");
  });

  it("server action memanggil RPC terautentikasi", async () => {
    const form = new FormData();
    form.set("id", "22222222-2222-4222-8222-222222222222");
    await approveApplicationOnboardingAction(form);
    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("approve_application_onboarding", {
      p_application_id: "22222222-2222-4222-8222-222222222222",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/admin/pendaftaran");
  });

  it("menolak ID tidak valid sebelum RPC", async () => {
    const form = new FormData();
    form.set("id", "invalid");
    await expect(approveApplicationOnboardingAction(form)).rejects.toThrow("Pendaftaran tidak valid");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
