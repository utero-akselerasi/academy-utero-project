import { z } from "zod";

export const checkInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  wifiSsid: z.string().optional(),
});

export const checkOutSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  wifiSsid: z.string().optional(),
});

const clock = z.string().regex(/^\d{1,2}:\d{2}$/, "Jam harus berbentuk HH:MM.").refine(
  (value) => { const [hour, minute] = value.split(":").map(Number); return hour < 24 && minute < 60; },
  "Jam tidak valid.",
);

export const attendanceSettingsSchema = z.object({
  checkInTime: clock,
  checkInEndTime: clock,
  monthlyTargetHours: z.number().int().min(0).max(744),
  allowGeofencing: z.boolean(),
  officeLatitude: z.number().min(-90, "Latitude minimal -90.").max(90, "Latitude maksimal 90.").nullable(),
  officeLongitude: z.number().min(-180, "Longitude minimal -180.").max(180, "Longitude maksimal 180.").nullable(),
  radiusMeters: z.number().int("Radius harus bilangan bulat.").min(0, "Radius tidak boleh negatif.").max(100_000, "Radius maksimal 100.000 meter."),
}).superRefine((value, context) => {
  const minutes = (clockValue: string) => { const [hour, minute] = clockValue.split(":").map(Number); return hour * 60 + minute; };
  if (clock.safeParse(value.checkInTime).success && clock.safeParse(value.checkInEndTime).success &&
      (minutes(value.checkInEndTime) <= minutes(value.checkInTime) || minutes(value.checkInEndTime) + 480 >= 1440)) {
    context.addIssue({ code: "custom", path: ["checkInEndTime"], message: "Batas masuk harus setelah jam mulai dan memungkinkan pulang 8 jam kemudian pada hari yang sama." });
  }
  if (value.allowGeofencing) {
    if (value.officeLatitude === null) context.addIssue({ code: "custom", path: ["officeLatitude"], message: "Latitude wajib saat GPS aktif." });
    if (value.officeLongitude === null) context.addIssue({ code: "custom", path: ["officeLongitude"], message: "Longitude wajib saat GPS aktif." });
  }
});

export const reviewAttendanceSchema = z.object({
  attendanceId: z.string().uuid("ID absensi tidak valid."),
  status: z.enum(["valid", "invalid", "manual_review"]),
  note: z.string().optional(),
});
