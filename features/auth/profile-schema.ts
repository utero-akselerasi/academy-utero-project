import { z } from "zod";

const requiredText = (label: string, maximum: number) =>
  z.string().trim().min(1, `${label} wajib diisi.`).max(maximum, `${label} maksimal ${maximum} karakter.`);
const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).transform((value) => value || null);
const phone = (label: string) => requiredText(label, 25).regex(/^\+?[0-9][0-9\s()-]{7,24}$/, `${label} tidak valid.`);

export const internBiodataSchema = z.object({
  fullName: requiredText("Nama lengkap", 150),
  phone: phone("Nomor telepon"),
  major: requiredText("Jurusan", 120),
  gradeOrSemester: requiredText("Kelas atau semester", 60),
  schoolName: requiredText("Nama sekolah atau kampus", 150),
  address: requiredText("Alamat lengkap", 500),
  schoolSupervisorName: requiredText("Nama guru pembimbing", 150),
  schoolSupervisorPhone: phone("Nomor guru pembimbing"),
  emergencyContactName: optionalText(150),
  emergencyContactPhone: optionalText(25),
}).superRefine((data, context) => {
  if (Boolean(data.emergencyContactName) !== Boolean(data.emergencyContactPhone)) {
    context.addIssue({ code: "custom", path: ["emergencyContactName"], message: "Isi nama dan nomor kontak darurat bersama-sama." });
  } else if (data.emergencyContactPhone && !/^\+?[0-9][0-9\s()-]{7,24}$/.test(data.emergencyContactPhone)) {
    context.addIssue({ code: "custom", path: ["emergencyContactPhone"], message: "Nomor kontak darurat tidak valid." });
  }
});

export const generalProfileSchema = z.object({
  fullName: requiredText("Nama lengkap", 150),
  phone: optionalText(25),
  headline: optionalText(150),
  bio: optionalText(2000),
});

export type InternProfileData = {
  id: string;
  full_name: string;
  phone: string | null;
  major: string | null;
  grade_or_semester: string | null;
  school_name: string | null;
  address: string | null;
  school_supervisor_name: string | null;
  school_supervisor_phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  schools?: { name: string } | null;
};

export function isInternBiodataComplete(profile: InternProfileData | null, fullName: string | null, email: string | null) {
  return Boolean(profile && email && internBiodataSchema.safeParse({
    fullName,
    phone: profile.phone,
    major: profile.major,
    gradeOrSemester: profile.grade_or_semester,
    schoolName: profile.school_name,
    address: profile.address,
    schoolSupervisorName: profile.school_supervisor_name,
    schoolSupervisorPhone: profile.school_supervisor_phone,
    emergencyContactName: profile.emergency_contact_name ?? "",
    emergencyContactPhone: profile.emergency_contact_phone ?? "",
  }).success);
}
