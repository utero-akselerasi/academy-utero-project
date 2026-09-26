import { NextResponse } from "next/server";
import { RouteAuthorizationError, requireRouteRole } from "@/features/auth/guards";
import { buildCsv, csvResponseHeaders, type CsvCell } from "@/lib/csv";
import { getSchoolProfile } from "@/features/school/queries";
import { getSchoolReportMetrics } from "@/features/school/queries-report";
import { writeAuditLog } from "@/features/super-admin/audit";

/** Batas rentang laporan; menyamai features/school/actions.ts. */
const MAX_REPORT_RANGE_DAYS = 366;

function parseCalendarDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return parsed.toISOString().slice(0, 10) === value ? parsed : null;
}

export async function GET(request: Request) {
  let user;
  try {
    // Hanya role portal sekolah. Daftar sebelumnya menyertakan admin dan
    // admin_academy, padahal getSchoolProfile() hanya me-resolve baris
    // school_contacts: mereka selalu berakhir 403, jadi izin itu menyesatkan.
    // super_admin tetap didaftarkan agar konsisten dengan layout portal ini,
    // dan tetap butuh school_contacts untuk mengunduh data sekolah tertentu.
    user = await requireRouteRole(["school", "super_admin"]);
  } catch (error) {
    if (error instanceof RouteAuthorizationError) {
      return new NextResponse(error.message, { status: error.status });
    }
    throw error;
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const fromDate = parseCalendarDate(from);
  const toDate = parseCalendarDate(to);

  if (!fromDate || !toDate || fromDate > toDate) {
    return new NextResponse("Periode tidak valid.", { status: 400 });
  }

  // Tanpa batas ini satu request bisa memaksa pemindaian rentang tak terbatas.
  const rangeDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24) + 1;
  if (rangeDays > MAX_REPORT_RANGE_DAYS) {
    return new NextResponse(`Rentang laporan maksimal ${MAX_REPORT_RANGE_DAYS} hari.`, { status: 400 });
  }

  const { data: schoolProfile } = await getSchoolProfile(user.id);
  if (!schoolProfile) {
    return new NextResponse("Akses sekolah tidak valid.", { status: 403 });
  }

  const { data: metrics } = await getSchoolReportMetrics(schoolProfile.id, from!, to!);
  if (!metrics) {
    return new NextResponse("Data laporan tidak ditemukan.", { status: 404 });
  }

  const rows: CsvCell[][] = [[
    "Nama Siswa",
    "Email",
    "Jurusan",
    "Status",
    "Attendance Rate",
    "Total Jam",
    "Manual Review",
    "Izin",
    "Sakit",
    "Nilai Akhir",
  ]];

  metrics.students.forEach((student) => {
    rows.push([
      student.full_name,
      student.email,
      student.major,
      student.status,
      `${student.attendance_rate}%`,
      student.total_hours,
      student.late_count,
      student.permit_count,
      student.sick_count,
      student.final_score,
    ]);
  });

  // Ekspor data siswa adalah peristiwa yang perlu terlacak: siapa mengunduh
  // data sekolah mana, periode apa, dan berapa baris.
  await writeAuditLog(
    user.id,
    "export_school_report_csv",
    "school_reports",
    metrics.school_id,
    null,
    null,
    { period_start: from, period_end: to, total_students: metrics.total_students, row_count: rows.length - 1 },
  );

  // Nama file diturunkan dari periode yang sudah divalidasi, bukan dari query
  // string bebas — mencegah header injection pada Content-Disposition.
  return new NextResponse(buildCsv(rows), {
    headers: csvResponseHeaders(`laporan-sekolah-${from}-${to}.csv`),
  });
}
