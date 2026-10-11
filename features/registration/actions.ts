"use server";

import { requireApplicant } from "@/features/auth/guards";
import { userHasAnyRole } from "@/features/auth/roles";
import { createSupabaseServiceRoleClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { UploadValidationError, buildStoragePath, validateUpload } from "@/lib/uploads";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  programId: z.string().uuid(), fullName: z.string().trim().min(3).max(150),
  phone: z.string().trim().min(8).max(25), schoolName: z.string().trim().min(2).max(150),
  major: z.string().trim().min(2).max(120), motivation: z.string().trim().min(20).max(3000),
  studentNumber: z.string().trim().max(80), referralCode: z.string().trim().max(80),
  proposedStartDate: z.string().date(), proposedEndDate: z.string().date(),
}).refine((value) => value.proposedEndDate >= value.proposedStartDate, { path: ["proposedEndDate"], message: "Tanggal selesai tidak boleh sebelum tanggal mulai." });

export type RegistrationState = { ok: boolean; message: string };

export async function submitRegistrationAction(_: RegistrationState, formData: FormData): Promise<RegistrationState> {
  const user = await requireApplicant();
  if (await userHasAnyRole(user.id, ["intern"])) return { ok: false, message: "Akun ini sudah menjadi peserta magang." };
  if (!user.email) return { ok: false, message: "Email akun belum tersedia." };
  const input = schema.safeParse(Object.fromEntries([...formData.entries()].filter(([key]) => key !== "cv" && key !== "portfolio")));
  if (!input.success) return { ok: false, message: input.error.issues[0]?.message ?? "Data pendaftaran tidak valid." };
  const cvFile = formData.get("cv");
  const portfolioFile = formData.get("portfolio");
  if (!(cvFile instanceof File) || cvFile.size === 0) return { ok: false, message: "Berkas CV wajib diunggah." };
  let cv;
  let portfolio = null;
  try {
    cv = await validateUpload(cvFile, ["document", "image"]);
    if (portfolioFile instanceof File && portfolioFile.size > 0) portfolio = await validateUpload(portfolioFile, ["document", "image"]);
  } catch (error) {
    return { ok: false, message: error instanceof UploadValidationError ? error.message : "Berkas tidak dapat diproses." };
  }
  const db = await createUteroAcademyServiceRoleClient();
  const { data: existing } = await db.from("internship_applications").select("id").eq("applicant_user_id", user.id).not("status", "in", '("rejected","cancelled","converted")').limit(1).maybeSingle();
  if (existing) return { ok: false, message: "Masih ada pendaftaran aktif. Pantau statusnya dari portal pelamar." };
  const { data: program } = await db.from("programs").select("id").eq("id", input.data.programId).eq("status", "published").maybeSingle();
  if (!program) return { ok: false, message: "Program tidak tersedia untuk pendaftaran." };
  let schoolId: string | null = null;
  let registeredSchoolName = input.data.schoolName;
  if (input.data.referralCode) {
    const { data: school } = await db.from("schools").select("id,name,partner_status,referral_quota,referral_expires_at").ilike("referral_code", input.data.referralCode).maybeSingle();
    if (!school || !["verified", "active_partner"].includes(school.partner_status) || (school.referral_expires_at && new Date(school.referral_expires_at) < new Date())) return { ok: false, message: "Kode sekolah tidak valid atau sudah tidak aktif." };
    if (school.referral_quota) {
      const { count } = await db.from("internship_applications").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("source", "self");
      if ((count ?? 0) >= school.referral_quota) return { ok: false, message: "Kuota kode sekolah sudah penuh." };
    }
    schoolId = school.id;
    registeredSchoolName = school.name;
  }
  const storage = createSupabaseServiceRoleClient().storage.from("academy-private");
  const uploadedPaths: string[] = [];
  try {
    const cvPath = buildStoragePath(`${user.id}/applications/cv`, cv.ext);
    const cvUpload = await storage.upload(cvPath, cv.buffer, { contentType: cv.contentType, upsert: false });
    if (cvUpload.error) throw cvUpload.error;
    uploadedPaths.push(cvPath);
    let portfolioPath: string | null = null;
    if (portfolio) {
      portfolioPath = buildStoragePath(`${user.id}/applications/portfolio`, portfolio.ext);
      const upload = await storage.upload(portfolioPath, portfolio.buffer, { contentType: portfolio.contentType, upsert: false });
      if (upload.error) throw upload.error;
      uploadedPaths.push(portfolioPath);
    }
    const { error } = await db.from("internship_applications").insert({ program_id: input.data.programId, school_id: schoolId, source: "self", applicant_user_id: user.id, submitted_by_user_id: user.id, full_name: input.data.fullName, email: user.email.toLowerCase(), phone: input.data.phone, school_name: registeredSchoolName, student_number: input.data.studentNumber || null, major: input.data.major, motivation: input.data.motivation, proposed_start_date: input.data.proposedStartDate, proposed_end_date: input.data.proposedEndDate, cv_path: cvPath, portfolio_path: portfolioPath, status: "submitted", submitted_at: new Date().toISOString() });
    if (error) throw error;
  } catch (error) {
    if (uploadedPaths.length) await storage.remove(uploadedPaths);
    console.error("Gagal menyimpan pendaftaran pelamar:", error);
    return { ok: false, message: "Pendaftaran belum berhasil disimpan. Coba lagi atau hubungi admin." };
  }
  revalidatePath("/dashboard/applicant");
  return { ok: true, message: "Pendaftaran terkirim. Pantau review dan seleksi dari halaman ini." };
}
