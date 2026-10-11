"use server";

import { createSupabaseServiceRoleClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { parseSchoolApplicationsCsv } from "./csv";
import { requireActiveSchoolPartner } from "./queries";
import { schoolApplicationSchema, type SchoolApplicationInput } from "./schemas";
import type { BulkImportState, CreateApplicationState } from "./types";

const MAX_CSV_BYTES = 1024 * 1024;
const MAX_CSV_ROWS = 200;

function applicationInsert(input: SchoolApplicationInput, schoolId: string, schoolName: string, userId: string) {
  return {
    full_name: input.fullName,
    email: input.email,
    phone: input.phone,
    student_number: input.studentNumber,
    school_name: schoolName,
    school_id: schoolId,
    major: input.major,
    motivation: input.motivation,
    proposed_start_date: input.proposedStartDate,
    proposed_end_date: input.proposedEndDate,
    source: "school",
    submitted_by_user_id: userId,
    status: "submitted",
    selection_status: "not_assigned",
    onboarding_status: "not_started",
    submitted_at: new Date().toISOString(),
  };
}

async function findDuplicate(schoolId: string, email: string, studentNumber: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const [emailResult, studentResult] = await Promise.all([
    db.from("internship_applications").select("id").eq("school_id", schoolId).eq("email", email).not("status", "in", '("rejected","cancelled","converted")').limit(1),
    db.from("internship_applications").select("id").eq("school_id", schoolId).eq("student_number", studentNumber).not("status", "in", '("rejected","cancelled","converted")').limit(1),
  ]);
  if (emailResult.error || studentResult.error) throw new Error("Pemeriksaan duplikasi pendaftaran gagal.");
  return Boolean(emailResult.data?.length || studentResult.data?.length);
}

async function inviteApplicant(email: string, fullName: string, applicationId: string) {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, source_app: "utero_academy_applicant" },
    });
    if (error || !data.user) return false;
    const db = await createUteroAcademyServiceRoleClient();
    const { error: linkError } = await db.from("internship_applications")
      .update({ applicant_user_id: data.user.id })
      .eq("id", applicationId)
      .is("applicant_user_id", null);
    return !linkError;
  } catch {
    return false;
  }
}

export async function createSchoolApplicationAction(
  _: CreateApplicationState,
  formData: FormData,
): Promise<CreateApplicationState> {
  try {
    const { userId, school } = await requireActiveSchoolPartner();
    const parsed = schoolApplicationSchema.safeParse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      studentNumber: formData.get("studentNumber"),
      major: formData.get("major"),
      motivation: formData.get("motivation"),
      proposedStartDate: formData.get("proposedStartDate"),
      proposedEndDate: formData.get("proposedEndDate"),
    });
    if (!parsed.success) {
      return { ok: false, message: "Periksa kembali data peserta.", fieldErrors: parsed.error.flatten().fieldErrors };
    }
    if (await findDuplicate(school.id, parsed.data.email, parsed.data.studentNumber)) {
      return { ok: false, message: "Email atau NIS/NIM sudah memiliki pendaftaran aktif di sekolah ini." };
    }

    const db = await createUteroAcademyServiceRoleClient();
    const { data: inserted, error } = await db.from("internship_applications").insert(
      applicationInsert(parsed.data, school.id, school.name, userId),
    ).select("id").single();
    if (error || !inserted) throw new Error("Pendaftaran peserta belum berhasil disimpan.");

    const invited = await inviteApplicant(parsed.data.email, parsed.data.fullName, inserted.id);

    revalidatePath("/dashboard/school/applications");
    return { ok: true, message: invited ? "Pendaftaran tersimpan dan undangan akun pelamar dikirim." : "Pendaftaran tersimpan, tetapi undangan belum terkirim. Hubungi admin untuk tindak lanjut." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Pendaftaran gagal diproses." };
  }
}

export async function importSchoolApplicationsCsvAction(
  _: BulkImportState,
  formData: FormData,
): Promise<BulkImportState> {
  try {
    const { userId, school } = await requireActiveSchoolPartner();
    const file = formData.get("csv");
    if (!(file instanceof File) || file.size === 0) throw new Error("Pilih berkas CSV terlebih dahulu.");
    if (file.size > MAX_CSV_BYTES) throw new Error("Ukuran CSV maksimal 1 MB.");
    if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("Berkas harus berformat CSV.");

    const parsedRows = parseSchoolApplicationsCsv(await file.text());
    if (parsedRows.length === 0) throw new Error("CSV tidak memiliki baris peserta.");
    if (parsedRows.length > MAX_CSV_ROWS) throw new Error(`Maksimal ${MAX_CSV_ROWS} peserta per import.`);

    const db = await createUteroAcademyServiceRoleClient();
    const results = [];

    for (const parsedRow of parsedRows) {
      if (!parsedRow.data) {
        results.push(parsedRow.result);
        continue;
      }
      if (await findDuplicate(school.id, parsedRow.data.email, parsedRow.data.studentNumber)) {
        results.push({ ...parsedRow.result, status: "duplicate" as const, errors: ["Email atau NIS/NIM sudah terdaftar."] });
        continue;
      }

      const { data: inserted, error } = await db.from("internship_applications").insert(
        applicationInsert(parsedRow.data, school.id, school.name, userId),
      ).select("id").single();
      if (error || !inserted) {
        results.push({ ...parsedRow.result, status: "invalid" as const, errors: ["Baris gagal disimpan."] });
        continue;
      }
      const invited = await inviteApplicant(parsedRow.data.email, parsedRow.data.fullName, inserted.id);
      results.push({ ...parsedRow.result, status: "created" as const, errors: invited ? [] : ["Pendaftaran tersimpan; undangan akun belum terkirim. Hubungi admin."] });
    }

    const created = results.filter((row) => row.status === "created").length;
    revalidatePath("/dashboard/school/applications");
    return {
      ok: created > 0,
      message: `${created} dari ${results.length} peserta berhasil dibuat.`,
      total: results.length,
      created,
      failed: results.length - created,
      rows: results,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "CSV gagal diproses.",
      total: 0,
      created: 0,
      failed: 0,
      rows: [],
    };
  }
}
