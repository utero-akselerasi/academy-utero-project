import { describe, expect, it } from "vitest";
import { hasApprovedOnboarding } from "@/features/intern/activation";

const profile = { id: "intern-1", start_date: "2026-10-01", end_date: "2026-12-31" };
const approved = {
  status: "accepted", onboarding_status: "waiting_start", converted_intern_id: "intern-1",
  approved_start_date: "2026-10-01", approved_end_date: "2026-12-31",
};

describe("hasApprovedOnboarding", () => {
  it("menerima approval existing yang menunggu mulai atau sudah aktif", () => {
    expect(hasApprovedOnboarding(approved, profile)).toBe(true);
    expect(hasApprovedOnboarding({ ...approved, onboarding_status: "active" }, profile)).toBe(true);
  });

  it.each(["not_started", "accepted_pending_onboarding", "biodata_review", "onboarding_complete"])("menolak status pra-approval %s", (onboarding_status) => {
    expect(hasApprovedOnboarding({ ...approved, onboarding_status }, profile)).toBe(false);
  });

  it("menolak aplikasi belum accepted atau periode yang tidak cocok", () => {
    expect(hasApprovedOnboarding({ ...approved, status: "reviewed" }, profile)).toBe(false);
    expect(hasApprovedOnboarding({ ...approved, approved_start_date: "2026-10-02" }, profile)).toBe(false);
    expect(hasApprovedOnboarding({ ...approved, converted_intern_id: "intern-2" }, profile)).toBe(false);
  });
});
