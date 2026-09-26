"use server";

import { requireUser } from "@/features/auth/guards";
import { createSupabaseServiceRoleClient, createUteroAcademyClient } from "@/lib/supabase/server";
import { getInternProfileId, getMentorProfileId } from "@/features/daily-reports/queries";
import { UploadValidationError, buildStoragePath, validateUpload } from "@/lib/uploads";
import { revalidatePath } from "next/cache";

export type ProfileFormState = {
  ok: boolean;
  message: string;
};

export async function updateProfileAction(_: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  // Aksi self-service: semua update dibatasi ke profil milik sesi aktif.
  const user = await requireUser();
  const fullName = formData.get("fullName");
  const phone = formData.get("phone");
  const avatarFile = formData.get("avatar") as File;
  if (!fullName) return { ok: false, message: "Nama lengkap wajib diisi." };
  const db = await createUteroAcademyClient();
  let avatarPath = null;
  if (avatarFile && avatarFile.size > 0) {
    // Tipe & ekstensi tetap ditentukan dari isi berkas, bukan dari nama/MIME
    // klien. Alasan aslinya (bucket publik → .html/.svg jadi stored XSS) sudah
    // hilang setelah 0032b memprivatkan bucket, tapi validasinya tetap: berkas
    // tetap terlayani lewat signed URL, dan signed URL sama saja mengeksekusi
    // HTML di origin Storage.
    let avatar;
    try {
      avatar = await validateUpload(avatarFile, ["image"]);
    } catch (error) {
      if (error instanceof UploadValidationError) {
        return { ok: false, message: error.message };
      }
      console.error("Gagal memvalidasi avatar:", error);
      return { ok: false, message: "Foto profil tidak dapat diproses." };
    }

    const filePath = buildStoragePath(user.id, avatar.ext);
    const serviceRoleSupabase = createSupabaseServiceRoleClient();
    const { error: uploadErr } = await serviceRoleSupabase.storage
      .from("avatars")
      .upload(filePath, avatar.buffer, { contentType: avatar.contentType, upsert: false });
    if (uploadErr) {
      console.error("Gagal upload avatar:", uploadErr);
      return { ok: false, message: "Gagal mengunggah foto profil." };
    }
    // Object path, bukan URL. Ditandatangani saat dibaca di
    // `ProtectedDashboardLayout`.
    avatarPath = filePath;
  }
  const updateData: any = { full_name: fullName, phone: phone || null, updated_at: new Date().toISOString() };
  if (avatarPath) updateData.avatar_path = avatarPath;
  const { error: profileErr } = await db.from("user_profiles").update(updateData).eq("id", user.id);
  if (profileErr) {
    console.error("Gagal update user profile:", profileErr);
    return { ok: false, message: "Gagal memperbarui profil utama." };
  }
  const internId = await getInternProfileId(user.id);
  if (internId) {
    const major = formData.get("major");
    const gradeOrSemester = formData.get("gradeOrSemester");
    await db.from("intern_profiles").update({ full_name: fullName, phone: phone || null, major: major || null, grade_or_semester: gradeOrSemester || null, updated_at: new Date().toISOString() }).eq("id", internId);
  }
  const mentorId = await getMentorProfileId(user.id);
  if (mentorId) {
    const headline = formData.get("headline");
    const bio = formData.get("bio");
    await db.from("mentor_profiles").update({ headline: headline || null, bio: bio || null, updated_at: new Date().toISOString() }).eq("id", mentorId);
  }
  revalidatePath("/dashboard/profile");
  return { ok: true, message: "Profil berhasil diperbarui!" };
}
