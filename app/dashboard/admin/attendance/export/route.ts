import { RouteAuthorizationError, requireRouteAdmin } from "@/features/auth/guards";
import { buildCsv, csvResponseHeaders, type CsvCell } from "@/lib/csv";
import { jakartaDateString, jakartaMinutesOfDay, parseWallClockMinutes } from "@/lib/time";
import { NextResponse } from "next/server";
import { localAttendanceExportData } from "@/features/attendance/local";
import { getElapsedMonthlyAttendanceTarget, getMonthlyAttendanceTarget } from "@/lib/attendance-calendar";

const MAX_RANGE_DAYS = 92;

type AttendanceLog = {
  intern_id: string;
  attendance_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  status: "pending" | "valid" | "invalid" | "manual_review";
  attendance_type?: "present" | "permit" | "sick" | null;
};

type InternProfile = {
  id: string;
  full_name: string;
  email: string | null;
  major: string | null;
  phone: string | null;
  start_date?: string | null;
  end_date?: string | null;
  internship_start_date?: string | null;
  internship_end_date?: string | null;
};

function getPeriodTarget(startDate: string, endDate: string, intern: InternProfile) {
  const activeStart = intern.internship_start_date ?? intern.start_date;
  if (!activeStart) return { workdays: 0, hours: 0 };
  const activeEnd = intern.internship_end_date ?? intern.end_date;
  const from = [startDate, activeStart].filter((date): date is string => !!date).sort().at(-1)!;
  const to = [endDate, activeEnd].filter((date): date is string => !!date).sort()[0];
  if (from > to) return { workdays: 0, hours: 0 };

  let workdays = 0;
  let hours = 0;
  let cursor = from.slice(0, 7);
  const lastMonth = to.slice(0, 7);
  while (cursor <= lastMonth) {
    const target = getMonthlyAttendanceTarget(cursor, from, to);
    workdays += target.workdays;
    hours += target.hours;
    const [year, month] = cursor.split("-").map(Number);
    cursor = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
  }
  return { workdays, hours };
}

function getMonthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;

  const [year, monthNumber] = month.split("-").map(Number);
  if (year < 100 || monthNumber < 1 || monthNumber > 12) return null;

  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 0));

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

/**
 * Regex saja tidak cukup: "2026-02-31" lolos pola tapi bukan tanggal nyata.
 * Round-trip lewat Date.UTC memastikan tanggal kalender valid.
 */
function parseCalendarDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return parsed.toISOString().slice(0, 10) === value ? parsed : null;
}

/**
 * `jakartaMinutesOfDay`, bukan `getHours()`: `getHours()` memetakan instan ke
 * jam dinding memakai zona waktu **proses Node**, jadi telat/tidaknya absensi
 * peserta ikut berubah kalau `TZ` container hilang atau berbeda — lihat
 * `lib/time.ts` untuk alasan lengkapnya.
 *
 * `NaN` dari timestamp yang rusak dikembalikan sebagai 0 menit telat, bukan
 * dibiarkan menjalar: `NaN` akan lolos filter `> 0` sebagai false lalu muncul
 * di CSV sebagai sel kosong, sedangkan 0 berarti "tidak terhitung telat" —
 * yang merupakan sikap yang benar terhadap data yang tidak bisa dibaca.
 */
function getLateMinutes(log: AttendanceLog, checkInMinutes: number, lateTolerance: number) {
  if (log.attendance_type !== "present" || !log.check_in_at) return 0;

  const actualMinutes = jakartaMinutesOfDay(new Date(log.check_in_at));
  if (!Number.isFinite(actualMinutes)) return 0;

  const minutesPastSchedule = actualMinutes - checkInMinutes;

  return minutesPastSchedule > lateTolerance ? minutesPastSchedule - lateTolerance : 0;
}

function getAttendanceHours(log: AttendanceLog) {
  if (log.attendance_type !== "present" || !log.check_in_at || !log.check_out_at) return 0;

  const diffMs = new Date(log.check_out_at).getTime() - new Date(log.check_in_at).getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60));
}

function getCreditedHours(logs: AttendanceLog[], startDate: string, endDate: string) {
  const dailyHours = new Map<string, number>();
  for (const log of logs) {
    if (log.attendance_type !== "present" || (log.status !== "valid" && log.status !== "pending") ||
      log.attendance_date < startDate || log.attendance_date > endDate ||
      new Date(`${log.attendance_date}T00:00:00Z`).getUTCDay() === 0) continue;
    dailyHours.set(log.attendance_date, (dailyHours.get(log.attendance_date) ?? 0) + getAttendanceHours(log));
  }
  return [...dailyHours.values()].reduce((total, hours) => total + Math.min(8, hours), 0);
}

export async function GET(request: Request) {
  try {
    // Export memuat PII peserta; otorisasi mendahului permintaan backend.
    await requireRouteAdmin();
  } catch (error) {
    if (error instanceof RouteAuthorizationError) {
      return new NextResponse(error.message, { status: error.status });
    }
    throw error;
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "range" ? "range" : "monthly";
  const today = jakartaDateString();
  const month = url.searchParams.get("month") || today.slice(0, 7);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  let period = getMonthRange(month);
  let periodLabel = month;
  let targetMode = "Target sesuai periode magang";

  if (mode === "range") {
    const startDate = parseCalendarDate(start);
    const endDate = parseCalendarDate(end);

    if (!startDate || !endDate || startDate > endDate) {
      return new NextResponse("Range tanggal export tidak valid.", { status: 400 });
    }

    const rangeDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) + 1;
    if (rangeDays > MAX_RANGE_DAYS) {
      return new NextResponse(`Range export maksimal ${MAX_RANGE_DAYS} hari.`, { status: 400 });
    }

    period = { startDate: start!, endDate: end! };
    periodLabel = `${start} s/d ${end}`;
    targetMode = "Target sesuai rentang tanggal";
  }

  if (!period) {
    return new NextResponse("Bulan export tidak valid.", { status: 400 });
  }

  let result;
  try {
    result = await localAttendanceExportData(period.startDate, period.endDate, mode);
  } catch (error) {
    return new NextResponse(error instanceof Error ? error.message : "Gagal memuat export.", { status: 503 });
  }
  const settings = result.settings;
  const interns: InternProfile[] = result.interns;
  const attendances: AttendanceLog[] = result.attendances;

  const lateTolerance = settings?.late_tolerance_minutes ?? 15;

  // `parseWallClockMinutes` mengembalikan null untuk bentuk yang tidak valid,
  // jadi default 08:00 dipilih secara eksplisit. Sebelumnya `split(":").map(Number)`
  // langsung: isi kolom yang rusak menghasilkan `NaN`, dan setiap perbandingan
  // telat terhadap NaN bernilai false — artinya **tidak ada peserta yang pernah
  // terhitung telat**, tanpa satu pun error muncul.
  const checkInMinutes = parseWallClockMinutes(settings?.check_in_time) ?? 8 * 60;

  const rows: CsvCell[][] = [[
    "Nama",
    "Email",
    "Jurusan",
    "No. HP",
    "Periode",
    "Tanggal Mulai",
    "Tanggal Selesai",
    "Total Hadir",
    "Total Jam",
    "Target Jam Bulanan",
    "Mode Target",
    "Status Target",
    "Total Telat",
    "Total Menit Telat",
    "Total Izin",
    "Total Sakit/Tidak Masuk",
    "Pending Review",
    "Invalid",
    "Jam Diakui (Maks 8/Hari Kerja)",
    "Target Jam Berjalan",
    "Progres Target (%)",
  ]];

  interns.forEach((intern) => {
    const target = getPeriodTarget(period.startDate, period.endDate, intern);
    const activeStart = intern.internship_start_date ?? intern.start_date;
    const elapsedTarget = mode === "monthly" && month === today.slice(0, 7)
      ? activeStart ? getElapsedMonthlyAttendanceTarget(month, today, activeStart, intern.internship_end_date ?? intern.end_date) : { workdays: 0, hours: 0 }
      : target;
    const logs = attendances.filter((attendance) => attendance.intern_id === intern.id);
    const presentCount = logs.filter((log) => log.attendance_type === "present" && (log.status === "valid" || log.status === "pending")).length;
    const permitCount = logs.filter((log) => log.attendance_type === "permit").length;
    const sickCount = logs.filter((log) => log.attendance_type === "sick").length;
    const pendingCount = logs.filter((log) => log.status === "pending" || log.status === "manual_review").length;
    const invalidCount = logs.filter((log) => log.status === "invalid").length;
    const totalHours = logs.reduce((total, log) => total + getAttendanceHours(log), 0);
    const creditedHours = activeStart ? getCreditedHours(logs,
      [period.startDate, activeStart].sort().at(-1)!,
      [period.endDate, intern.internship_end_date ?? intern.end_date].filter((date): date is string => !!date).sort()[0]) : 0;
    const lateMinutesList = logs.map((log) => getLateMinutes(log, checkInMinutes, lateTolerance)).filter((minutes) => minutes > 0);
    const progressHours = activeStart ? getCreditedHours(logs,
      [period.startDate, activeStart].sort().at(-1)!,
      [period.endDate, intern.internship_end_date ?? intern.end_date, mode === "monthly" && month === today.slice(0, 7) ? today : null]
        .filter((date): date is string => !!date).sort()[0]) : 0;
    const targetStatus = !activeStart ? "Periode belum diatur" : target.hours === 0 ? "Belum aktif" : creditedHours >= target.hours ? "Terpenuhi" : "Belum Terpenuhi";

    rows.push([
      intern.full_name,
      intern.email,
      intern.major,
      intern.phone,
      periodLabel,
      period.startDate,
      period.endDate,
      presentCount,
      Number(totalHours.toFixed(2)),
      target.hours,
      targetMode,
      targetStatus,
      lateMinutesList.length,
      lateMinutesList.reduce((total, minutes) => total + minutes, 0),
      permitCount,
      sickCount,
      pendingCount,
      invalidCount,
      Number(creditedHours.toFixed(2)),
      elapsedTarget.hours,
      elapsedTarget.hours > 0 ? Math.min(100, Math.round((progressHours / elapsedTarget.hours) * 100)) : 0,
    ]);
  });

  const filenamePeriod = mode === "monthly" ? month : `${period.startDate}_${period.endDate}`;
  const csv = buildCsv(rows);

  return new NextResponse(csv, {
    headers: csvResponseHeaders(`rekap-absensi-${filenamePeriod}.csv`),
  });
}
