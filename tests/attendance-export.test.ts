import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/guards", () => ({
  requireRouteAdmin: vi.fn(),
  RouteAuthorizationError: class RouteAuthorizationError extends Error {},
}));
vi.mock("@/features/attendance/local", () => ({ localAttendanceExportData: vi.fn() }));

import { localAttendanceExportData } from "@/features/attendance/local";
import { GET } from "@/app/dashboard/admin/attendance/export/route";

const intern: { id: string; full_name: string; email: null; major: null; phone: null; start_date?: string } = {
  id: "1", full_name: "Peserta", email: null, major: null, phone: null, start_date: "2026-01-01",
};

async function exportRow(query: string, profiles: Array<typeof intern & { start_date?: string; end_date?: string }>) {
  vi.mocked(localAttendanceExportData).mockResolvedValue({
    settings: { monthly_target_hours: 120 }, interns: profiles, attendances: [],
  } as Awaited<ReturnType<typeof localAttendanceExportData>>);
  const response = await GET(new Request(`http://localhost/dashboard/admin/attendance/export?${query}`));
  expect(response.status).toBe(200);
  const [header, ...rows] = (await response.text()).replace(/^\uFEFF/, "").split("\r\n");
  const columns = header.split(",").map((cell) => cell.slice(1, -1));
  return rows.map((row) => Object.fromEntries(row.split(",").map((cell, index) => [columns[index], cell.slice(1, -1)])));
}

describe("attendance CSV targets", () => {
  it("counts Monday–Saturday × 8h per intern across monthly internship intersection", async () => {
    const rows = await exportRow("month=2026-02", [intern, { ...intern, id: "2", start_date: "2026-02-09", end_date: "2026-02-15" }, { ...intern, id: "3", start_date: "2026-03-01" }]);
    expect(rows.map((row) => row["Target Jam Bulanan"])).toEqual(["192", "48", "0"]);
    expect(rows[0]["Status Target"]).toBe("Belum Terpenuhi");
    expect(rows[2]["Status Target"]).toBe("Belum aktif");
  });

  it("counts requested range across month boundary and clips internship dates", async () => {
    const rows = await exportRow("mode=range&start=2026-02-26&end=2026-03-03", [{ ...intern, start_date: "2026-02-27", end_date: "2026-03-02" }]);
    expect(rows[0]["Target Jam Bulanan"]).toBe("24");
    expect(rows[0]["Mode Target"]).toBe("Target sesuai rentang tanggal");
  });

  it("does not invent a target when internship start date is missing", async () => {
    const rows = await exportRow("month=2026-02", [{ ...intern, start_date: undefined }]);
    expect(rows[0]["Target Jam Bulanan"]).toBe("0");
    expect(rows[0]["Status Target"]).toBe("Periode belum diatur");
  });

  it("keeps raw hours while capping credited hours daily and excluding Sundays/outside internship", async () => {
    vi.mocked(localAttendanceExportData).mockResolvedValue({ settings: null, interns: [{ ...intern, start_date: "2026-02-02", end_date: "2026-02-03" }], attendances: [
      { intern_id: "1", attendance_date: "2026-02-01", check_in_at: "2026-02-01T00:00:00Z", check_out_at: "2026-02-01T10:00:00Z", attendance_type: "present", status: "valid" },
      { intern_id: "1", attendance_date: "2026-02-02", check_in_at: "2026-02-02T00:00:00Z", check_out_at: "2026-02-02T10:00:00Z", attendance_type: "present", status: "valid" },
      { intern_id: "1", attendance_date: "2026-02-02", check_in_at: "2026-02-02T10:00:00Z", check_out_at: "2026-02-02T12:00:00Z", attendance_type: "present", status: "valid" },
      { intern_id: "1", attendance_date: "2026-02-04", check_in_at: "2026-02-04T00:00:00Z", check_out_at: "2026-02-04T08:00:00Z", attendance_type: "present", status: "valid" },
      { intern_id: "1", attendance_date: "2026-02-03", check_in_at: "2026-02-03T00:00:00Z", check_out_at: "2026-02-03T08:00:00Z", attendance_type: "present", status: "invalid" },
    ] } as unknown as Awaited<ReturnType<typeof localAttendanceExportData>>);
    const response = await GET(new Request("http://localhost/dashboard/admin/attendance/export?month=2026-02"));
    const [header, row] = (await response.text()).replace(/^\uFEFF/, "").split("\r\n").map((line) => line.split(",").map((cell) => cell.slice(1, -1)));
    expect(row[header.indexOf("Total Jam")]).toBe("38");
    expect(row[header.indexOf("Jam Diakui (Maks 8/Hari Kerja)")]).toBe("8");
    expect(row[header.indexOf("Target Jam Bulanan")]).toBe("16");
  });

  it("uses Jakarta today for current-month elapsed target; past month retains full target", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-02-10T20:00:00Z")); // February 11 in Jakarta.
      const current = await exportRow("month=2026-02", [intern]);
      expect(current[0]["Target Jam Bulanan"]).toBe("192");
      expect(current[0]["Target Jam Berjalan"]).toBe("72");
      expect(current[0]["Progres Target (%)"]).toBe("0");
      const past = await exportRow("month=2026-01", [intern]);
      expect(past[0]["Target Jam Berjalan"]).toBe(past[0]["Target Jam Bulanan"]);
    } finally {
      vi.useRealTimers();
    }
  });
});
