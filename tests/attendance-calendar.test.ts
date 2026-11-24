import { describe, expect, it } from "vitest";
import { getElapsedMonthlyAttendanceTarget, getMonthlyAttendanceTarget } from "../lib/attendance-calendar";

describe("calendar attendance targets", () => {
  it("counts Monday through Saturday at eight hours each", () => {
    expect(getMonthlyAttendanceTarget("2026-11")).toEqual({ workdays: 25, hours: 200 });
    expect(getMonthlyAttendanceTarget("2026-12")).toEqual({ workdays: 27, hours: 216 });
  });

  it("excludes Sundays and intersects active dates inclusively", () => {
    expect(getMonthlyAttendanceTarget("2026-11", "2026-11-01", "2026-11-08")).toEqual({ workdays: 6, hours: 48 });
    expect(getMonthlyAttendanceTarget("2026-11", "2026-11-15", "2026-11-21")).toEqual({ workdays: 6, hours: 48 });
    expect(getMonthlyAttendanceTarget("2026-11", "2026-12-01")).toEqual({ workdays: 0, hours: 0 });
  });

  it("counts elapsed target through as-of date, inclusively and clamped", () => {
    expect(getElapsedMonthlyAttendanceTarget("2026-11", "2026-11-10")).toEqual({ workdays: 8, hours: 64 });
    expect(getElapsedMonthlyAttendanceTarget("2026-11", "2026-11-10", "2026-11-05", "2026-11-20")).toEqual({ workdays: 5, hours: 40 });
    expect(getElapsedMonthlyAttendanceTarget("2026-11", "2026-12-01")).toEqual(getMonthlyAttendanceTarget("2026-11"));
  });

  it("handles leap February and month-boundary intersections", () => {
    expect(getMonthlyAttendanceTarget("2024-02")).toEqual({ workdays: 25, hours: 200 });
    expect(getMonthlyAttendanceTarget("2026-02", "2026-01-31", "2026-03-01")).toEqual({ workdays: 24, hours: 192 });
  });

  it.each(["", "2026-1", "2026-13", "26-11", "0026-11", "2026-00"]) ("returns zero for invalid month %s", (month) => {
    expect(getMonthlyAttendanceTarget(month)).toEqual({ workdays: 0, hours: 0 });
  });

  it("returns zero for impossible active or as-of dates", () => {
    expect(getMonthlyAttendanceTarget("2026-11", "2026-02-30")).toEqual({ workdays: 0, hours: 0 });
    expect(getMonthlyAttendanceTarget("2026-11", "0026-11-01")).toEqual({ workdays: 0, hours: 0 });
    expect(getElapsedMonthlyAttendanceTarget("2026-11", "2026-11-31")).toEqual({ workdays: 0, hours: 0 });
  });
});
