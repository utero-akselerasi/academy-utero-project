import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSchoolProfile } from "@/features/school/queries";
import { getSchoolReportMetrics } from "@/features/school/queries-report";

function escapeCsvCell(value: string | number | null | undefined) {
  const stringValue = value === null || value === undefined ? "" : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function buildCsv(rows: Array<Array<string | number | null | undefined>>) {
  return "\uFEFF" + rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const filename = url.searchParams.get("filename") || `laporan-sekolah-${from}-${to}.csv`;

  if (!from || !to || from > to) {
    return new NextResponse("Periode tidak valid.", { status: 400 });
  }

  const { data: schoolProfile } = await getSchoolProfile(user.id);
  if (!schoolProfile) {
    return new NextResponse("Akses sekolah tidak valid.", { status: 403 });
  }

  const { data: metrics } = await getSchoolReportMetrics(schoolProfile.id, from, to);
  if (!metrics) {
    return new NextResponse("Data laporan tidak ditemukan.", { status: 404 });
  }

  const rows: Array<Array<string | number | null | undefined>> = [[
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

  return new NextResponse(buildCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
