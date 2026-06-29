import { z } from "zod";

export const dailyReportSchema = z.object({
  reportDate: z.string().min(1, "Tanggal laporan wajib diisi."),
  todayWork: z.string().min(10, "Pekerjaan hari ini minimal 10 karakter."),
  progress: z.string().optional(),
  blockers: z.string().optional(),
  tomorrowPlan: z.string().optional(),
});

export const reviewReportSchema = z.object({
  reportId: z.string().uuid("ID laporan tidak valid."),
  status: z.enum(["approved", "revision_requested"]),
  note: z.string().optional(),
});
