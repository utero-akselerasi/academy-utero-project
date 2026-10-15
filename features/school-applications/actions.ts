"use server";

import { createSupabaseServiceRoleClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseSchoolApplicationsCsv } from "./csv";
import { requireActiveSchoolPartner } from "./queries";
import { schoolApplicationSchema, type SchoolApplicationInput } from "./schemas";
import type { BulkImportState, CreateApplicationState } from "./types";
import { usesLocalBackend } from "@/lib/backend/mode";
import { schoolBackend } from "@/features/school/local";

const MAX_CSV_BYTES = 1024 * 1024;
const MAX_CSV_ROWS = 200;
const AUTH_USERS_PAGE_SIZE = 1000;
const AUTH_USERS_MAX_PAGES = 100;

class ApplicantRoleConflictError extends Error {}

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
    await ensureApplicantRole(data.user.id);
    await ensureApplicantProfile(data.user.id, fullName);
    await linkApplicant(applicationId, data.user.id);
    return true;
  } catch {
    return false;
  }
}

type UserRoleCodeRow = { roles: { code: string } | Array<{ code: string }> | null };

function roleCode(row: UserRoleCodeRow) {
  return Array.isArray(row.roles) ? row.roles[0]?.code : row.roles?.code;
}

async function readRoleCodes(userId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db.from("user_roles").select("roles(code)").eq("user_id", userId).returns<UserRoleCodeRow[]>();
  if (error) throw new Error("Role akun pelamar belum dapat diperiksa.");
  return new Set((data ?? []).map(roleCode).filter((code): code is string => Boolean(code)));
}

async function ensureApplicantRole(userId: string) {
  const currentRoles = await readRoleCodes(userId);
  if ([...currentRoles].some((code) => code !== "applicant")) {
    throw new ApplicantRoleConflictError("Akun sudah memiliki role internal dan tidak dapat dijadikan applicant.");
  }
  if (currentRoles.has("applicant")) return;

  const db = await createUteroAcademyServiceRoleClient();
  const { data: applicantRole, error: roleError } = await db.from("roles").select("id").eq("code", "applicant").maybeSingle();
  if (roleError || !applicantRole) throw new Error("Role applicant belum tersedia.");
  const { data: inserted, error: insertError } = await db.from("user_roles")
    .insert({ user_id: userId, role_id: applicantRole.id })
    .select("id")
    .single();
  if (insertError && insertError.code !== "23505") throw new Error("Role applicant belum berhasil diberikan.");

  const verifiedRoles = await readRoleCodes(userId);
  if ([...verifiedRoles].some((code) => code !== "applicant")) {
    if (inserted?.id) await db.from("user_roles").delete().eq("id", inserted.id);
    throw new ApplicantRoleConflictError("Akun sudah memiliki role internal dan tidak dapat dijadikan applicant.");
  }
  if (!verifiedRoles.has("applicant")) throw new Error("Role applicant belum berhasil diverifikasi.");
}

async function ensureApplicantProfile(userId: string, fullName: string) {
  const normalizedName = fullName.trim();
  if (!normalizedName) throw new Error("Nama profil applicant tidak valid.");
  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db.from("user_profiles").insert({
    id: userId,
    full_name: normalizedName,
    is_active: true,
  });
  if (error && error.code !== "23505") throw new Error("Profil applicant belum berhasil disiapkan.");
}

async function findAuthUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const supabase = createSupabaseServiceRoleClient();
  for (let page = 1; page <= AUTH_USERS_MAX_PAGES; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: AUTH_USERS_PAGE_SIZE });
    if (error) throw new Error("Pemeriksaan akun pelamar gagal.");
    const matches = data.users.filter((user) => user.email?.trim().toLowerCase() === normalizedEmail);
    if (matches.length > 1) throw new Error("Email terhubung ke lebih dari satu akun.");
    if (matches[0]) return matches[0];
    if (data.users.length < AUTH_USERS_PAGE_SIZE) return null;
  }
  throw new Error("Pemeriksaan akun pelamar belum dapat diselesaikan.");
}

async function linkApplicant(applicationId: string, userId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db.from("internship_applications")
    .update({ applicant_user_id: userId })
    .eq("id", applicationId)
    .is("applicant_user_id", null)
    .select("id, applicant_user_id")
    .maybeSingle();
  if (error) throw new Error("Akun pelamar belum berhasil ditautkan.");
  if (data?.applicant_user_id === userId) return;

  const { data: current, error: currentError } = await db.from("internship_applications")
    .select("applicant_user_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (currentError || !current?.applicant_user_id) throw new Error("Akun pelamar belum berhasil ditautkan.");
  if (current.applicant_user_id !== userId) throw new Error("Pendaftaran sudah tertaut ke akun lain.");
}

export async function retryApplicantInvitationAction(formData: FormData): Promise<void> {
  if (usesLocalBackend()) {
      await requireActiveSchoolPartner();
      const applicationId = formData.get("applicationId");
      if (typeof applicationId !== "string") redirect("/dashboard/school/applications?invite=failed");
      try {
        await schoolBackend(`/applications/${encodeURIComponent(applicationId)}/invite`, { method: "POST" });
        redirect("/dashboard/school/applications?invite=sent");
      } catch {
        redirect("/dashboard/school/applications?invite=failed");
      }
  }
  let outcome = "failed";
  try {
    const applicationId = formData.get("applicationId");
    if (typeof applicationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(applicationId)) {
      throw new Error("Pendaftaran tidak valid.");
    }
    const { school } = await requireActiveSchoolPartner();
    const db = await createUteroAcademyServiceRoleClient();
    const { data: application, error } = await db.from("internship_applications")
      .select("id, email, full_name, source, applicant_user_id")
      .eq("id", applicationId)
      .eq("school_id", school.id)
      .maybeSingle();
    if (error || !application || application.source !== "school") throw new Error("Pendaftaran tidak ditemukan.");
    if (application.applicant_user_id) {
      outcome = "linked";
    } else {
      const email = schoolApplicationSchema.shape.email.parse(application.email);
      const existingUser = await findAuthUserByEmail(email);
      if (existingUser) {
        await ensureApplicantRole(existingUser.id);
        await ensureApplicantProfile(existingUser.id, application.full_name);
        await linkApplicant(application.id, existingUser.id);
        outcome = "linked";
      } else {
        const invited = await inviteApplicant(email, application.full_name, application.id);
        if (!invited) throw new Error("Undangan belum berhasil dikirim.");
        outcome = "sent";
      }
    }
  } catch (error) {
    outcome = error instanceof ApplicantRoleConflictError ? "role-conflict" : "failed";
  }
  revalidatePath("/dashboard/school/applications");
  redirect(`/dashboard/school/applications?invite=${outcome}`);
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
    if (usesLocalBackend()) {
      const created = await schoolBackend<{ id: string }>("/applications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) });
      let invited = true;
      try { await schoolBackend(`/applications/${encodeURIComponent(created.id)}/invite`, { method: "POST" }); } catch { invited = false; }
      revalidatePath("/dashboard/school/applications");
      return { ok: true, message: invited ? "Pendaftaran tersimpan dan undangan akun pelamar dikirim." : "Pendaftaran tersimpan, tetapi undangan belum terkirim." };
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

    if (usesLocalBackend()) {
      const results = [];
      for (const parsedRow of parsedRows) {
        if (!parsedRow.data) { results.push(parsedRow.result); continue; }
        try {
          const created = await schoolBackend<{ id: string }>("/applications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsedRow.data) });
          await schoolBackend(`/applications/${encodeURIComponent(created.id)}/invite`, { method: "POST" });
          results.push({ ...parsedRow.result, status: "created" as const, errors: [] });
        } catch (error) {
          const duplicate = error instanceof Error && error.message === "duplicate_application";
          results.push({ ...parsedRow.result, status: duplicate ? "duplicate" as const : "invalid" as const, errors: [duplicate ? "Email atau NIS/NIM sudah terdaftar." : "Baris gagal disimpan."] });
        }
      }
      const created = results.filter((row) => row.status === "created").length;
      revalidatePath("/dashboard/school/applications");
      return { ok: created > 0, message: `${created} dari ${results.length} peserta berhasil dibuat.`, total: results.length, created, failed: results.length - created, rows: results };
    }

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
