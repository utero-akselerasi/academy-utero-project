import { z } from "zod";
import { selectionQuestionTypes } from "./types";

const uuid = z.string().uuid("ID tidak valid.");
const requiredText = (label: string, max: number) => z.string().trim().min(1, `${label} wajib diisi.`).max(max);

export const createTrackSchema = z.object({
  name: requiredText("Nama jalur", 120),
  code: z.string().trim().min(2).max(80).regex(/^[A-Z0-9]+(?:_[A-Z0-9]+)*$/, "Kode memakai huruf kapital, angka, dan garis bawah."),
  description: z.string().trim().max(1000).optional().default(""),
});

export const createMaterialSchema = z.object({
  trackId: uuid,
  title: requiredText("Judul materi", 180),
  content: z.string().trim().max(20000).optional().default(""),
  attachmentPath: z.string().trim().max(1000).optional().default(""),
  orderIndex: z.coerce.number().int().min(0).max(10000).default(0),
});

export const createTestSchema = z.object({
  trackId: uuid,
  code: z.string().trim().min(2).max(80).regex(/^[A-Z0-9]+(?:_[A-Z0-9]+)*$/),
  title: requiredText("Judul tes", 180),
  description: z.string().trim().max(2000).optional().default(""),
  passingScore: z.coerce.number().min(0).max(100),
  durationMinutes: z.coerce.number().int().min(1).max(480),
  maxAttempts: z.coerce.number().int().min(1).max(10).default(1),
});

export const createQuestionSchema = z.object({
  testId: uuid,
  type: z.enum(selectionQuestionTypes),
  prompt: requiredText("Pertanyaan", 5000),
  points: z.coerce.number().positive().max(1000),
  orderIndex: z.coerce.number().int().min(0).max(10000).default(0),
  expectedAnswer: z.string().trim().max(5000).optional().default(""),
  options: z.string().trim().max(10000).optional().default(""),
  correctOption: z.string().trim().max(500).optional().default(""),
}).superRefine((value, ctx) => {
  if (["multiple_choice", "true_false"].includes(value.type)) {
    const options = parseOptionLines(value.type === "true_false" ? "Benar\nSalah" : value.options);
    if (options.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "Minimal dua opsi wajib diisi." });
    if (!options.includes(value.correctOption)) ctx.addIssue({ code: "custom", path: ["correctOption"], message: "Jawaban benar harus sama dengan salah satu opsi." });
  }
});

export const assignApplicantSchema = z.object({
  applicationId: uuid,
  testId: uuid,
  dueAt: z.union([z.literal(""), z.string().datetime({ local: true })]).default(""),
});

export const gradeAnswerSchema = z.object({
  answerId: uuid,
  assignmentId: uuid,
  awardedPoints: z.coerce.number().min(0).max(1000),
  maxPoints: z.coerce.number().positive().max(1000),
  feedback: z.string().trim().max(3000).optional().default(""),
}).refine((value) => value.awardedPoints <= value.maxPoints, { message: "Nilai tidak boleh melebihi bobot soal.", path: ["awardedPoints"] });

export const decisionSchema = z.object({
  assignmentId: uuid,
  applicationId: uuid,
  decision: z.enum(["passed", "failed", "waitlisted"]),
  notes: z.string().trim().max(3000).optional().default(""),
});

export const bypassSchema = z.object({
  applicationId: uuid,
  assignmentId: z.union([z.literal(""), uuid]).default(""),
  reason: requiredText("Alasan bypass", 3000).refine((value) => value.length >= 20, "Alasan bypass minimal 20 karakter."),
});

export function parseOptionLines(value: string): string[] {
  return [...new Set(value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))];
}

export function formDataObject(formData: FormData): Record<string, string> {
  return Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)]));
}
