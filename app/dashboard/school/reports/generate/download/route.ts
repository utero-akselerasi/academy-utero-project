import { NextResponse } from "next/server";
import { RouteAuthorizationError, requireRouteRole } from "@/features/auth/guards";
import { buildCsv, csvResponseHeaders, type CsvCell } from "@/lib/csv";
import { getSchoolProfile } from "@/features/school/queries";
import { getSchoolReportMetrics } from "@/features/school/queries-report";

function parseCalendarDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return parsed.toISOString().slice(0, 10) === value ? parsed : null;
}

export async function GET(request: Request) {
  let user;
  try {
    user = await requireRouteRole(["school", "admin", "admin_academy", "super_admin"]);
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

  // Nama file diturunkan dari periode yang sudah divalidasi, bukan dari query
  // string bebas — mencegah header injection pada Content-Disposition.
  return new NextResponse(buildCsv(rows), {
    headers: csvResponseHeaders(`laporan-sekolah-${from}-${to}.csv`),
  });
}
