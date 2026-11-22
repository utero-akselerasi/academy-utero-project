import { describe, expect, it } from "vitest";
import { applicationStatusLabel, formatApplicationDate, formatApplicationTime } from "../features/admin/application-display";

describe("admin application display", () => {
  it("formats date-only values and PostgreSQL timestamps as Jakarta calendar dates", () => {
    expect(formatApplicationDate("2026-08-01")).toBe("1 Agustus 2026");
    expect(formatApplicationDate("2026-11-18")).toBe("18 November 2026");
    expect(formatApplicationDate("2026-07-31T17:00:00.000Z")).toBe("1 Agustus 2026");
    expect(formatApplicationDate(null)).toBe("-");
    expect(formatApplicationDate("invalid")).toBe("-");
  });

  it("translates review states without exposing database codes", () => {
    expect(applicationStatusLabel("reviewed")).toBe("Sudah ditinjau");
    expect(applicationStatusLabel("not_assigned")).toBe("Belum ditugaskan");
    expect(applicationStatusLabel("passed")).toBe("Lolos seleksi");
    expect(applicationStatusLabel("expired")).toBe("Waktu habis");
    expect(formatApplicationTime("invalid")).toBe("-");
  });
});
