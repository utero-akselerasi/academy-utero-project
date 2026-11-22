"use server";

import { requireApplicant } from "@/features/auth/guards";
import { userHasAnyRole } from "@/features/auth/roles";
import { createSupabaseServiceRoleClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { UploadValidationError, buildStoragePath, validateUpload } from "@/lib/uploads";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { backendRequest, usesLocalBackend } from "@/lib/backend/server";

const schema = z.object({
  programId: z.string().uuid(), fullName: z.string().trim().min(3).max(150),
  phone: z.string().trim().regex(/^62[0-9]{8,13}$/, "Nomor WhatsApp harus berupa angka dan diawali 62 (contoh: 6281234567890)."), schoolName: z.string().trim().min(2).max(150),
  major: z.string().trim().min(2).max(120), motivation: z.string().trim().min(20).max(3000),
  studentNumber: z.string().trim().max(80), referralCode: z.string().trim().max(80),
  proposedStartDate: z.string().date(), proposedEndDate: z.string().date(),
}).refine((value) => value.proposedEndDate >= value.proposedStartDate, { path: ["proposedEndDate"], message: "Tanggal selesai tidak boleh sebelum tanggal mulai." });

export type RegistrationState = { ok: boolean; message: string };
const maxRegistrationFileBytes = 5 * 1024 * 1024;

export async function submitRegistrationAction(_: RegistrationState, formData: FormData): Promise<RegistrationState> {
  const user = await requireApplicant();
  if (!usesLocalBackend() && await userHasAnyRole(user.id, ["intern"])) return { ok: false, message: "Akun ini sudah menjadi peserta magang." };
  if (!user.email) return { ok: false, message: "Email akun belum tersedia." };
  const input = schema.safeParse(Object.fromEntries([...formData.entries()].filter(([, value]) => !(value instanceof File))));
  if (!input.success) return { ok: false, message: input.error.issues[0]?.message ?? "Data pendaftaran tidak valid." };
  const cvFile = formData.get("cv");
  const portfolioFile = formData.get("portfolio");
  const schoolLetterFile = formData.get("schoolLetter");
  const proposalFile = formData.get("proposal");
  const photoFile = formData.get("photo");
  if (!(cvFile instanceof File) || cvFile.size === 0) return { ok: false, message: "Berkas CV wajib diunggah." };
  if (!(schoolLetterFile instanceof File) || !schoolLetterFile.size) return { ok: false, message: "Surat pengantar sekolah/kampus wajib diunggah." };
  if (!(photoFile instanceof File) || !photoFile.size) return { ok: false, message: "Foto profil wajib diunggah." };
  if ([cvFile, portfolioFile, schoolLetterFile, proposalFile, photoFile].some((file) => file instanceof File && file.size > maxRegistrationFileBytes)) return { ok: false, message: "Setiap berkas maksimal 5 MB." };
  let cv;
  let portfolio = null;
  let schoolLetter;
  let proposal = null;
  let photo;
  try {
    cv = await validateUpload(cvFile, ["document", "image"]);
    if (portfolioFile instanceof File && portfolioFile.size > 0) portfolio = await validateUpload(portfolioFile, ["document", "image"]);
    schoolLetter = await validateUpload(schoolLetterFile, ["document", "image"]);
    if (proposalFile instanceof File && proposalFile.size > 0) proposal = await validateUpload(proposalFile, ["document", "image"]);
    photo = await validateUpload(photoFile, ["image"]);
    if (!["image/jpeg", "image/png", "image/webp"].includes(photo.contentType)) return { ok: false, message: "Foto profil harus JPG, PNG, atau WebP." };
  } catch (error) {
    return { ok: false, message: error instanceof UploadValidationError ? error.message : "Berkas tidak dapat diproses." };
  }
  if (usesLocalBackend()) {
    const paths: string[] = [];
    const uploaded: Record<string, string> = {};
    try {
      for (const [kind, upload] of [["cv", cv], ["portfolio", portfolio], ["school-letter", schoolLetter], ["proposal", proposal], ["photo", photo]] as const) {
        if (!upload) continue;
        const path = buildStoragePath(`${user.id}/applications/${kind}`, upload.ext);
        const body = new FormData();
        body.append("file", new Blob([Buffer.from(upload.buffer)], { type: upload.contentType }), upload.displayName);
        const response = await backendRequest("/v1/storage/academy-private", { method: "POST", headers: { "x-object-path": path }, body });
        if (!response.ok) throw new Error(`Upload gagal: ${response.status}`);
        paths.push(path);
        uploaded[kind] = path;
      }
      const response = await backendRequest("/v1/registration/applications", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...input.data, cvPath: uploaded.cv, portfolioPath: uploaded.portfolio ?? null, schoolLetterPath: uploaded["school-letter"], proposalPath: uploaded.proposal ?? null, photoPath: uploaded.photo }),
      });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error ?? `Pendaftaran gagal: ${response.status}`);
      }
      revalidatePath("/dashboard/applicant");
      return { ok: true, message: "Pendaftaran terkirim. Pantau review dan seleksi dari halaman ini." };
    } catch (error) {
      await Promise.allSettled(paths.map((path) => backendRequest(`/v1/storage/academy-private/${path}`, { method: "DELETE" })));
      console.error("Gagal menyimpan pendaftaran lokal:", error);
      return { ok: false, message: "Pendaftaran belum berhasil disimpan. Coba lagi atau hubungi admin." };
    }
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
    const uploaded: Record<string, string> = {};
    for (const [kind, document] of [["cv", cv], ["portfolio", portfolio], ["school-letter", schoolLetter], ["proposal", proposal], ["photo", photo]] as const) {
      if (!document) continue;
      const path = buildStoragePath(`${user.id}/applications/${kind}`, document.ext);
      const upload = await storage.upload(path, document.buffer, { contentType: document.contentType, upsert: false });
      if (upload.error) throw upload.error;
      uploadedPaths.push(path);
      uploaded[kind] = path;
    }
    const { error } = await db.from("internship_applications").insert({ program_id: input.data.programId, school_id: schoolId, source: "self", applicant_user_id: user.id, submitted_by_user_id: user.id, full_name: input.data.fullName, email: user.email.toLowerCase(), phone: input.data.phone, school_name: registeredSchoolName, student_number: input.data.studentNumber || null, major: input.data.major, motivation: input.data.motivation, proposed_start_date: input.data.proposedStartDate, proposed_end_date: input.data.proposedEndDate, cv_path: uploaded.cv, portfolio_path: uploaded.portfolio ?? null, school_letter_path: uploaded["school-letter"], proposal_path: uploaded.proposal ?? null, photo_path: uploaded.photo, status: "submitted", submitted_at: new Date().toISOString() });
    if (error) throw error;
  } catch (error) {
    if (uploadedPaths.length) await storage.remove(uploadedPaths);
    console.error("Gagal menyimpan pendaftaran pelamar:", error);
    return { ok: false, message: "Pendaftaran belum berhasil disimpan. Coba lagi atau hubungi admin." };
  }
  revalidatePath("/dashboard/applicant");
  return { ok: true, message: "Pendaftaran terkirim. Pantau review dan seleksi dari halaman ini." };
}
