import { describe, expect, it } from "vitest";
import { hasApprovedOnboarding, internDashboardAccess } from "@/features/intern/activation";

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

describe("internDashboardAccess", () => {
  const today = "2026-11-24";
  const pending = { ...profile, status: "pending" };

  it("mengaktifkan onboarding yang telah disetujui sebelum memuat dashboard", () => {
    expect(internDashboardAccess(pending, approved, true, today)).toBe("activate");
    expect(internDashboardAccess({ ...pending, status: "active" }, approved, true, today)).toBe("activate");
    expect(internDashboardAccess({ ...pending, status: "active" }, { ...approved, onboarding_status: "active" }, true, today)).toBe("ready");
  });

  it("menahan peserta yang belum aktif, belum disetujui, atau di luar periode", () => {
    expect(internDashboardAccess(pending, null, false, today)).toBe("waiting");
    expect(internDashboardAccess(pending, { ...approved, status: "reviewed" }, true, today)).toBe("waiting");
    expect(internDashboardAccess({ ...pending, status: "completed" }, approved, true, today)).toBe("waiting");
    expect(internDashboardAccess({ ...pending, start_date: "2026-12-01" }, approved, true, today)).toBe("waiting");
    expect(internDashboardAccess({ ...pending, status: "active", end_date: "2026-11-23" }, null, false, today)).toBe("waiting");
    expect(internDashboardAccess(null, null, false, today)).toBe("waiting");
  });

  it("mengizinkan profil aktif yang dibuat langsung", () => {
    expect(internDashboardAccess({ ...pending, status: "active" }, null, false, today)).toBe("ready");
  });
});
