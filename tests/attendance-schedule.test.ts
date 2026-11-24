import { describe, expect, it } from "vitest";
import { getExpectedCheckOut, getLateMinutes } from "../lib/attendance-schedule";

describe("jadwal kerja absensi", () => {
  it("menandai terlambat hanya setelah akhir rentang check-in Jakarta", () => {
    expect(getLateMinutes("2026-11-24T01:00:00Z", "09:00")).toBe(0);
    expect(getLateMinutes("2026-11-24T02:00:00Z", "09:00")).toBe(0);
    expect(getLateMinutes("2026-11-24T02:01:00Z", "09:00")).toBe(1);
    expect(getLateMinutes("2026-11-24T02:01:00Z", "09:30")).toBe(0);
    expect(getLateMinutes("invalid", "09:00")).toBe(0);
  });

  it("menghitung jam pulang dari check-in sebenarnya", () => {
    expect(getExpectedCheckOut("2026-11-24T01:00:00Z")?.toISOString()).toBe("2026-11-24T09:00:00.000Z");
    expect(getExpectedCheckOut("2026-11-24T02:00:00Z")?.toISOString()).toBe("2026-11-24T10:00:00.000Z");
    expect(getExpectedCheckOut("invalid")).toBeNull();
  });
});
