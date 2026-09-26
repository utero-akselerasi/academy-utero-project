"use server";

import { requireUser } from "@/features/auth/guards";
import { getSchoolProfile } from "@/features/school/queries";
import { getSchoolReportMetrics } from "@/features/school/queries-report";
import { buildCsv, type CsvCell } from "@/lib/csv";
import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

/** Batas rentang laporan: satu request tidak boleh memindai periode tak terbatas. */
const MAX_REPORT_RANGE_DAYS = 366;

const generateReportSchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal mulai tidak valid."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal akhir tidak valid."),
  })
  .refine((value) => value.from <= value.to, {
    message: "Tanggal mulai harus sebelum tanggal akhir.",
  })
  .refine(
    (value) => {
      const from = Date.parse(`${value.from}T00:00:00Z`);
      const to = Date.parse(`${value.to}T00:00:00Z`);
      if (Number.isNaN(from) || Number.isNaN(to)) return false;
      const days = (to - from) / (1000 * 60 * 60 * 24) + 1;
      return days <= MAX_REPORT_RANGE_DAYS;
    },
    { message: `Rentang laporan maksimal ${MAX_REPORT_RANGE_DAYS} hari.` },
  );

export type GenerateSchoolReportState = {
  ok: boolean;
  message: string;
};

/**
 * Membuat catatan laporan periodik sekolah.
 *
 * Sebelumnya ini dikerjakan oleh app/dashboard/school/reports/generate/page.tsx,
 * sebuah halaman GET yang menulis ke school_reports setiap kali dimuat:
 * bisa dipicu lewat prefetch/crawler/<img>, tanpa proteksi CSRF, dan tanpa
 * batas rentang tanggal. Sekarang jadi POST action dengan guard, validasi
 * rentang, dan dedup per (sekolah, periode).
 */
export async function generateSchoolReportAction(
  _: GenerateSchoolReportState,
  formData: FormData,
): Promise<GenerateSchoolReportState> {
  const user = await requireUser();

  const parsed = generateReportSchema.safeParse({
    from: formData.get("from"),
    to: formData.get("to"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Periode laporan tidak valid." };
  }

  const { from, to } = parsed.data;

  // Otorisasi data: hanya sekolah yang terkait user ini.
  const { data: schoolProfile } = await getSchoolProfile(user.id);
  if (!schoolProfile) {
    return { ok: false, message: "Akun ini tidak terhubung ke instansi mana pun." };
  }

  const { data: metrics } = await getSchoolReportMetrics(schoolProfile.id, from, to);
  if (!metrics) {
    return { ok: false, message: "Data laporan untuk periode ini tidak ditemukan." };
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

  const csvSize = Buffer.byteLength(buildCsv(rows), "utf8");
  const db = await createUteroAcademyServiceRoleClient();

  // Idempoten: satu periode per sekolah tidak menumpuk baris duplikat setiap
  // kali tombol generate ditekan.
  const { data: existing } = await db
    .from("school_reports")
    .select("id")
    .eq("school_id", metrics.school_id)
    .eq("period_start", from)
    .eq("period_end", to)
    .maybeSingle();

  const payload = {
    school_id: metrics.school_id,
    report_type: "monthly",
    period_start: from,
    period_end: to,
    generated_by: user.id,
    file_path: `/dashboard/school/reports/generate/download?from=${from}&to=${to}`,
    file_size: csvSize,
    total_students: metrics.total_students,
    status: "published",
  };

  const { error } = existing
    ? await db.from("school_reports").update(payload).eq("id", existing.id)
    : await db.from("school_reports").insert(payload);

  if (error) {
    console.error("Gagal menyimpan laporan sekolah:", error);
    return { ok: false, message: "Laporan belum berhasil disimpan. Coba lagi." };
  }

  revalidatePath("/dashboard/school/reports");
  redirect(`/dashboard/school/reports/generate/download?from=${from}&to=${to}`);
}
