import { z } from "zod";

const requiredText = (label: string, maximum: number) =>
  z.string().trim().min(1, `${label} wajib diisi.`).max(maximum, `${label} maksimal ${maximum} karakter.`);
const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).transform((value) => value || null);
export function normalizeIndonesianPhone(value: string) {
  const digits = value.replace(/[\s()+-]/g, "");
  return digits.startsWith("08") ? `62${digits.slice(1)}` : digits;
}

export function isValidIndonesianPhone(value: string) {
  return /^(?:\+?62|0)[0-9\s()-]*$/.test(value.trim()) && /^628[1-9]\d{7,10}$/.test(normalizeIndonesianPhone(value));
}

const phone = (label: string) => requiredText(label, 25)
  .refine(isValidIndonesianPhone, `${label} harus nomor seluler Indonesia, diawali 08 atau 628.`)
  .transform(normalizeIndonesianPhone);

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
  emergencyContactPhone: optionalText(25)
    .refine((value) => !value || isValidIndonesianPhone(value), "Nomor kontak darurat harus nomor seluler Indonesia, diawali 08 atau 628.")
    .transform((value) => value ? normalizeIndonesianPhone(value) : null),
}).superRefine((data, context) => {
  if (Boolean(data.emergencyContactName) !== Boolean(data.emergencyContactPhone)) {
    context.addIssue({ code: "custom", path: ["emergencyContactName"], message: "Isi nama dan nomor kontak darurat bersama-sama." });
  }
});

export const generalProfileSchema = z.object({
  fullName: requiredText("Nama lengkap", 150),
  phone: optionalText(25)
    .refine((value) => !value || isValidIndonesianPhone(value), "Nomor telepon harus nomor seluler Indonesia, diawali 08 atau 628.")
    .transform((value) => value ? normalizeIndonesianPhone(value) : null),
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
