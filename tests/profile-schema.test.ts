import { describe, expect, it } from "vitest";
import { internBiodataSchema, isInternBiodataComplete } from "@/features/auth/profile-schema";

const complete = {
  fullName: "Budi Santoso", phone: "+62 812-3456-7890", major: "Rekayasa Perangkat Lunak",
  gradeOrSemester: "XII", schoolName: "SMK Utero", address: "Jalan Contoh Nomor 10, Malang",
  schoolSupervisorName: "Ibu Sari", schoolSupervisorPhone: "081234567890",
  emergencyContactName: "Bapak Santoso", emergencyContactPhone: "081298765432",
};

describe("internBiodataSchema", () => {
  it("menerima biodata lengkap dan memangkas spasi", () => {
    const result = internBiodataSchema.parse({ ...complete, fullName: "  Budi Santoso  " });
    expect(result.fullName).toBe("Budi Santoso");
  });

  it("menolak field wajib yang kosong", () => {
    const result = internBiodataSchema.safeParse({ ...complete, address: "" });
    expect(result.success).toBe(false);
  });

  it("mewajibkan pasangan kontak darurat lengkap", () => {
    const result = internBiodataSchema.safeParse({ ...complete, emergencyContactPhone: "" });
    expect(result.success).toBe(false);
  });

  it("menolak nomor telepon yang tidak masuk akal", () => {
    const result = internBiodataSchema.safeParse({ ...complete, phone: "telepon saya" });
    expect(result.success).toBe(false);
  });
});

describe("isInternBiodataComplete", () => {
  it("menganggap profil lengkap hanya jika email akun dan semua field wajib ada", () => {
    const profile = {
      id: "intern-id", full_name: complete.fullName, phone: complete.phone, major: complete.major,
      grade_or_semester: complete.gradeOrSemester, school_name: complete.schoolName,
      address: complete.address, school_supervisor_name: complete.schoolSupervisorName,
      school_supervisor_phone: complete.schoolSupervisorPhone,
      emergency_contact_name: complete.emergencyContactName,
      emergency_contact_phone: complete.emergencyContactPhone,
    };
    expect(isInternBiodataComplete(profile, complete.fullName, "budi@example.com")).toBe(true);
    expect(isInternBiodataComplete(profile, complete.fullName, null)).toBe(false);
    expect(isInternBiodataComplete({ ...profile, major: null }, complete.fullName, "budi@example.com")).toBe(false);
  });
});
