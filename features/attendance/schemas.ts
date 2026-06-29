import { z } from "zod";

export const checkInSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  wifiSsid: z.string().optional(),
});

export const checkOutSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  wifiSsid: z.string().optional(),
});

export const reviewAttendanceSchema = z.object({
  attendanceId: z.string().uuid("ID absensi tidak valid."),
  status: z.enum(["valid", "invalid", "manual_review"]),
  note: z.string().optional(),
});
