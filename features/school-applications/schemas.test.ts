import { describe, expect, it } from "vitest";
import { parseSchoolApplicationsCsv } from "./csv";
import { schoolApplicationSchema } from "./schemas";
import { buildPublicTimeline } from "./status";
import type { SchoolApplication } from "./types";

const valid = { fullName: "Budi Santoso", email: "BUDI@example.com", phone: "081234567890", studentNumber: "12345", major: "RPL", motivation: "", proposedStartDate: "2027-01-01", proposedEndDate: "2027-03-31" };

describe("schoolApplicationSchema", () => {
  it("menormalisasi email dan menerima periode valid", () => expect(schoolApplicationSchema.parse(valid).email).toBe("budi@example.com"));
  it("menolak tanggal selesai sebelum mulai", () => expect(schoolApplicationSchema.safeParse({ ...valid, proposedEndDate: "2026-12-31" }).success).toBe(false));
});

describe("parseSchoolApplicationsCsv", () => {
  const header = "full_name,email,phone,student_number,major,motivation,proposed_start_date,proposed_end_date";
  it("mendukung koma dan newline di dalam sel berkutip", () => {
    const parsed = parseSchoolApplicationsCsv(`${header}\n\"Budi, Santoso\",budi@example.com,081234567890,12,RPL,\"baris 1\nbaris 2\",2027-01-01,2027-03-01`);
    expect(parsed[0].data?.fullName).toBe("Budi, Santoso");
  });
  it("menandai email dan NIS duplikat dalam file", () => {
    const row = "Budi,budi@example.com,081234567890,1,RPL,,2027-01-01,2027-03-01";
    const parsed = parseSchoolApplicationsCsv(`${header}\n${row}\n${row}`);
    expect(parsed[1].data).toBeNull();
    expect(parsed[1].result.errors.join(" ")).toContain("duplikat");
  });
});

describe("buildPublicTimeline", () => {
  it("hanya memakai status publik dan tidak membutuhkan catatan internal", () => {
    const application = { id: "1", fullName: "Budi", email: "budi@example.com", phone: null, studentNumber: "1", major: "RPL", motivation: null, status: "accepted", selectionStatus: "passed", onboardingStatus: "waiting_start", proposedStartDate: null, proposedEndDate: null, createdAt: "2027-01-01", updatedAt: "2027-01-03", reviewedAt: "2027-01-02", applicantUserId: null } satisfies SchoolApplication;
    expect(buildPublicTimeline(application).map((item) => item.label)).toEqual(["Pendaftaran dikirim", "Diterima", "Seleksi: Lolos seleksi", "Onboarding: Menunggu tanggal mulai"]);
  });
});
