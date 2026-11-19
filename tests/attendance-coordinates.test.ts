import { describe, expect, it } from "vitest";
import { parseAttendanceCoordinates } from "@/features/attendance/coordinates";

describe("parseAttendanceCoordinates", () => {
  it("mengubah numeric PostgreSQL berbentuk string menjadi number", () => {
    expect(parseAttendanceCoordinates("-7.9671000", "112.6375000")).toEqual({ latitude: -7.9671, longitude: 112.6375 });
  });

  it("menerima number dan koordinat nol", () => {
    expect(parseAttendanceCoordinates(0, 112.6375)).toEqual({ latitude: 0, longitude: 112.6375 });
  });

  it.each([
    [null, "112.6375"], ["-7.9671", null], ["", "112.6375"],
    ["bukan-angka", "112.6375"], ["91", "112.6375"], ["-7.9671", "181"],
  ])("menolak pasangan koordinat tidak lengkap atau tidak valid", (latitude, longitude) => {
    expect(parseAttendanceCoordinates(latitude, longitude)).toBeNull();
  });
});
