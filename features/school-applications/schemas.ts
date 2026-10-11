import { z } from "zod";
import { APPLICATION_STATUSES, SELECTION_STATUSES } from "./types";

const trimmed = (min: number, max: number, message: string) =>
  z.string().trim().min(min, message).max(max, `Maksimal ${max} karakter.`);

const optionalText = (max: number) =>
  z.string().trim().max(max, `Maksimal ${max} karakter.`).transform((value) => value || null);

const dateValue = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus memakai format YYYY-MM-DD.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Tanggal kalender tidak valid.");

export const schoolApplicationSchema = z
  .object({
    fullName: trimmed(3, 150, "Nama lengkap minimal 3 karakter."),
    email: z.string().trim().toLowerCase().email("Email tidak valid.").max(254),
    phone: trimmed(8, 25, "Nomor telepon minimal 8 karakter.").regex(
      /^[+\d][\d\s().-]{6,24}$/,
      "Nomor telepon tidak valid.",
    ),
    studentNumber: trimmed(2, 50, "NIS/NIM wajib diisi."),
    major: trimmed(2, 150, "Jurusan wajib diisi."),
    motivation: optionalText(2000),
    proposedStartDate: dateValue,
    proposedEndDate: dateValue,
  })
  .refine((value) => value.proposedStartDate <= value.proposedEndDate, {
    message: "Tanggal selesai tidak boleh sebelum tanggal mulai.",
    path: ["proposedEndDate"],
  });

export const applicationFilterSchema = z.object({
  query: z.string().trim().max(100).catch(""),
  status: z.enum(["all", ...APPLICATION_STATUSES]).catch("all"),
  selectionStatus: z.enum(["all", ...SELECTION_STATUSES]).catch("all"),
});

export type SchoolApplicationInput = z.infer<typeof schoolApplicationSchema>;
