import { RouteAuthorizationError, requireRouteAdmin } from "@/features/auth/guards";
import { resolveStaffInternScope } from "@/features/auth/scope";
import { writeAuditLog } from "@/features/super-admin/audit";
import { buildCsv, csvResponseHeaders, type CsvCell } from "@/lib/csv";
import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";
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
};

function getMonthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;

  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) return null;

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

function getLateMinutes(log: AttendanceLog, checkInMinutes: number, lateTolerance: number) {
  if (log.attendance_type !== "present" || !log.check_in_at) return 0;

  const checkInDate = new Date(log.check_in_at);
  const actualMinutes = checkInDate.getHours() * 60 + checkInDate.getMinutes();
  const minutesPastSchedule = actualMinutes - checkInMinutes;

  return minutesPastSchedule > lateTolerance ? minutesPastSchedule - lateTolerance : 0;
}

function getAttendanceHours(log: AttendanceLog) {
  if (log.attendance_type !== "present" || !log.check_in_at || !log.check_out_at) return 0;

  const diffMs = new Date(log.check_out_at).getTime() - new Date(log.check_in_at).getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60));
}

export async function GET(request: Request) {
  let user;
  try {
    // Export ini memuat PII peserta (email, telepon). Authorization harus lolos
    // sebelum query service-role apa pun dijalankan.
    user = await requireRouteAdmin();
  } catch (error) {
    if (error instanceof RouteAuthorizationError) {
      return new NextResponse(error.message, { status: error.status });
    }
    throw error;
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "range" ? "range" : "monthly";
  const month = url.searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  let period = getMonthRange(month);
  let periodLabel = month;
  let targetMode = "Target bulanan penuh";

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
    targetMode = "Tidak dinilai untuk custom range";
  }

  if (!period) {
    return new NextResponse("Bulan export tidak valid.", { status: 400 });
  }

  const scope = await resolveStaffInternScope(user.id);

  if (scope.kind === "setup_required") {
    return new NextResponse(
      "Profil pembimbing belum disiapkan. Hubungi super admin untuk mengaktifkan akses export.",
      { status: 403 },
    );
  }

  const db = await createUteroAcademyServiceRoleClient();

  const { data: settings } = await db
    .from("attendance_settings")
    .select("check_in_time, late_tolerance_minutes, monthly_target_hours")
    .eq("id", SETTINGS_ID)
    .maybeSingle();

  const checkInTime = settings?.check_in_time || "08:00";
  const lateTolerance = settings?.late_tolerance_minutes ?? 15;
  const monthlyTargetHours = settings?.monthly_target_hours ?? 120;
  const [checkInHour, checkInMinute] = checkInTime.split(":").map(Number);
  const checkInMinutes = checkInHour * 60 + checkInMinute;

  let interns: InternProfile[] = [];

  if (scope.kind === "global" || scope.internIds.length > 0) {
    let internQuery = db
      .from("intern_profiles")
      .select("id, full_name, email, major, phone")
      .eq("status", "active");

    if (scope.kind === "scoped") {
      internQuery = internQuery.in("id", scope.internIds);
    }

    const { data: internsData } = await internQuery
      .order("full_name", { ascending: true })
      .returns<InternProfile[]>();

    interns = internsData || [];
  }

  const internIds = interns.map((intern) => intern.id);

  const { data: attendancesData } = internIds.length > 0
    ? await db
      .from("attendances")
      .select("intern_id, attendance_date, check_in_at, check_out_at, status, attendance_type")
      .in("intern_id", internIds)
      .gte("attendance_date", period.startDate)
      .lte("attendance_date", period.endDate)
      .returns<AttendanceLog[]>()
    : { data: [] as AttendanceLog[] };

  const attendances = attendancesData || [];

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
  ]];

  interns.forEach((intern) => {
    const logs = attendances.filter((attendance) => attendance.intern_id === intern.id);
    const presentCount = logs.filter((log) => log.attendance_type === "present" && (log.status === "valid" || log.status === "pending")).length;
    const permitCount = logs.filter((log) => log.attendance_type === "permit").length;
    const sickCount = logs.filter((log) => log.attendance_type === "sick").length;
    const pendingCount = logs.filter((log) => log.status === "pending" || log.status === "manual_review").length;
    const invalidCount = logs.filter((log) => log.status === "invalid").length;
    const totalHours = logs.reduce((total, log) => total + getAttendanceHours(log), 0);
    const lateMinutesList = logs.map((log) => getLateMinutes(log, checkInMinutes, lateTolerance)).filter((minutes) => minutes > 0);
    const targetStatus = mode === "monthly"
      ? totalHours >= monthlyTargetHours ? "Terpenuhi" : "Belum Terpenuhi"
      : "-";

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
      monthlyTargetHours,
      targetMode,
      targetStatus,
      lateMinutesList.length,
      lateMinutesList.reduce((total, minutes) => total + minutes, 0),
      permitCount,
      sickCount,
      pendingCount,
      invalidCount,
    ]);
  });

  const filenamePeriod = mode === "monthly" ? month : `${period.startDate}_${period.endDate}`;
  const csv = buildCsv(rows);

  // Catat siapa mengekspor PII siapa — tanpa menyimpan isi CSV.
  await writeAuditLog(user.id, "attendance.export", "attendances", null, null, null, {
    mode,
    period_start: period.startDate,
    period_end: period.endDate,
    scope: scope.kind,
    intern_count: interns.length,
  });

  return new NextResponse(csv, {
    headers: csvResponseHeaders(`rekap-absensi-${filenamePeriod}.csv`),
  });
}
