import { createSupabaseServerClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { getSchoolProfile } from "@/features/school/queries";
import { getSchoolReportMetrics } from "@/features/school/queries-report";
import { redirect } from "next/navigation";

function escapeCsvCell(value: string | number | null | undefined) {
  const stringValue = value === null || value === undefined ? "" : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function buildCsv(rows: Array<Array<string | number | null | undefined>>) {
  return "\uFEFF" + rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export default async function GenerateSchoolReportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { from, to } = await searchParams;
  if (!from || !to || from > to) redirect("/dashboard/school/reports");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: schoolProfile } = await getSchoolProfile(user.id);
  if (!schoolProfile) redirect("/dashboard/school");

  const { data: metrics } = await getSchoolReportMetrics(schoolProfile.id, from, to);
  if (!metrics) redirect("/dashboard/school/reports");

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

  const csv = buildCsv(rows);
  const fileName = `laporan-sekolah-${metrics.school_id}-${from}-${to}.csv`;
  const db = await createUteroAcademyServiceRoleClient();

  await db.from("school_reports").insert({
    school_id: metrics.school_id,
    report_type: "monthly",
    period_start: from,
    period_end: to,
    generated_by: user.id,
    file_path: `/dashboard/school/reports/generate/download?from=${from}&to=${to}`,
    file_size: Buffer.byteLength(csv, "utf8"),
    total_students: metrics.total_students,
    status: "published",
  });

  redirect(`/dashboard/school/reports/generate/download?from=${from}&to=${to}&filename=${encodeURIComponent(fileName)}`);
}
