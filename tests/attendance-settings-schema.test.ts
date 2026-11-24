import { describe, expect, it } from "vitest";
import { attendanceSettingsSchema } from "../features/attendance/schemas";

const valid = {
  checkInTime: "08:00", checkInEndTime: "09:00",
  monthlyTargetHours: 208, allowGeofencing: false, officeLatitude: -6.2,
  officeLongitude: 106.8, radiusMeters: 100,
};

describe("attendance settings", () => {
  it("accepts stored coordinates when GPS is off and requires both when on", () => {
    expect(attendanceSettingsSchema.safeParse(valid).success).toBe(true);
    expect(attendanceSettingsSchema.safeParse({ ...valid, officeLatitude: null, officeLongitude: null }).success).toBe(true);
    const result = attendanceSettingsSchema.safeParse({ ...valid, allowGeofencing: true, officeLatitude: null, officeLongitude: null });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.path[0])).toEqual(["officeLatitude", "officeLongitude"]);
  });

  it.each([
    ["checkInTime", "24:00"], ["checkInEndTime", "07:30"], ["checkInEndTime", "16:30"],
    ["radiusMeters", -1], ["officeLatitude", 91], ["officeLongitude", -181],
  ])("rejects invalid %s", (field, value) => {
    const result = attendanceSettingsSchema.safeParse({ ...valid, [field]: value });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });
});
