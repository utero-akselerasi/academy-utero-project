"use server";

import { requireUser } from "@/features/auth/guards";
import { generalProfileSchema, internBiodataSchema } from "@/features/auth/profile-schema";
import { userHasAnyRole } from "@/features/auth/roles";
import { createSupabaseServiceRoleClient, createUteroAcademyClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { toObjectPath } from "@/lib/storage-urls";
import { UploadValidationError, buildStoragePath, validateUpload } from "@/lib/uploads";
import { revalidatePath } from "next/cache";

export type ProfileFormState = { ok: boolean; message: string };

const value = (formData: FormData, name: string) => String(formData.get(name) ?? "");

export async function updateProfileAction(_: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await requireUser();
  const database = await createUteroAcademyServiceRoleClient();
  const sessionDatabase = await createUteroAcademyClient();
  const [{ data: userProfile, error: profileReadError }, { data: internProfile, error: internReadError }, { data: mentorProfile, error: mentorReadError }] = await Promise.all([
    database.from("user_profiles").select("avatar_path").eq("id", user.id).maybeSingle(),
    database.from("intern_profiles").select("id,start_date,end_date,status").eq("user_id", user.id).maybeSingle(),
    database.from("mentor_profiles").select("id").eq("user_id", user.id).maybeSingle(),
  ]);
  if (profileReadError || internReadError || mentorReadError || !userProfile) {
    return { ok: false, message: "Profil tidak tersedia. Hubungi admin." };
  }
  if (!internProfile && await userHasAnyRole(user.id, ["intern"])) {
    return { ok: false, message: "Profil peserta belum dibuat. Hubungi admin." };
  }

  const parsed = internProfile
    ? internBiodataSchema.safeParse({
        fullName: value(formData, "fullName"), phone: value(formData, "phone"),
        major: value(formData, "major"), gradeOrSemester: value(formData, "gradeOrSemester"),
        schoolName: value(formData, "schoolName"), address: value(formData, "address"),
        schoolSupervisorName: value(formData, "schoolSupervisorName"),
        schoolSupervisorPhone: value(formData, "schoolSupervisorPhone"),
        emergencyContactName: value(formData, "emergencyContactName"),
        emergencyContactPhone: value(formData, "emergencyContactPhone"),
      })
    : generalProfileSchema.safeParse({
        fullName: value(formData, "fullName"), phone: value(formData, "phone"),
        headline: value(formData, "headline"), bio: value(formData, "bio"),
      });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Biodata tidak valid." };

  const avatarFile = formData.get("avatar");
  let newAvatarPath: string | null = null;
  if (avatarFile instanceof File && avatarFile.size > 0) {
    try {
      const avatar = await validateUpload(avatarFile, ["image"]);
      newAvatarPath = buildStoragePath(user.id, avatar.ext);
      const { error } = await createSupabaseServiceRoleClient().storage
        .from("avatars").upload(newAvatarPath, avatar.buffer, { contentType: avatar.contentType, upsert: false });
      if (error) throw error;
    } catch (error) {
      if (error instanceof UploadValidationError) return { ok: false, message: error.message };
      console.error("Gagal upload avatar:", error);
      return { ok: false, message: "Gagal mengunggah foto profil." };
    }
  }

  let updateError: { message?: string } | null = null;
  try {
    if (internProfile && "major" in parsed.data) {
      const { error } = await sessionDatabase.rpc("update_own_intern_biodata", {
        p_full_name: parsed.data.fullName, p_phone: parsed.data.phone,
        p_major: parsed.data.major, p_grade_or_semester: parsed.data.gradeOrSemester,
        p_school_name: parsed.data.schoolName, p_address: parsed.data.address,
        p_school_supervisor_name: parsed.data.schoolSupervisorName,
        p_school_supervisor_phone: parsed.data.schoolSupervisorPhone,
        p_emergency_contact_name: parsed.data.emergencyContactName,
        p_emergency_contact_phone: parsed.data.emergencyContactPhone,
        p_avatar_path: newAvatarPath,
      });
      updateError = error;
    } else if (!("major" in parsed.data)) {
      const { error } = await sessionDatabase.from("user_profiles").update({
        full_name: parsed.data.fullName, phone: parsed.data.phone,
        ...(newAvatarPath ? { avatar_path: newAvatarPath } : {}), updated_at: new Date().toISOString(),
      }).eq("id", user.id);
      updateError = error;
      if (!error && mentorProfile) {
        const { error: mentorError } = await sessionDatabase.from("mentor_profiles").update({
          headline: parsed.data.headline, bio: parsed.data.bio, updated_at: new Date().toISOString(),
        }).eq("id", mentorProfile.id);
        updateError = mentorError;
      }
    }
  } catch (error) {
    updateError = error instanceof Error ? error : { message: String(error) };
  }

  const storage = createSupabaseServiceRoleClient().storage.from("avatars");
  if (updateError) {
    if (newAvatarPath) {
      const { error: cleanupError } = await storage.remove([newAvatarPath]);
      if (cleanupError) console.error("Gagal membuang avatar unggahan yang tidak dipakai:", cleanupError);
    }
    console.error("Gagal update profil:", updateError);
    return { ok: false, message: internProfile
      ? "Gagal memperbarui biodata. Tidak ada perubahan yang disimpan."
      : "Gagal memperbarui profil. Periksa data sebelum mencoba lagi." };
  }

  const previousAvatarPath = toObjectPath(userProfile?.avatar_path, "avatars");
  if (newAvatarPath && previousAvatarPath && previousAvatarPath !== newAvatarPath &&
      new RegExp(`^${user.id}/[^/]+\\.(png|jpg|jpeg|webp|gif)$`, "i").test(previousAvatarPath)) {
    const { error } = await storage.remove([previousAvatarPath]);
    if (error) console.error("Gagal menghapus avatar lama:", error);
  }

  if (internProfile && "major" in parsed.data && ["pending", "active"].includes(internProfile.status)) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const active = Boolean(internProfile.start_date && internProfile.start_date <= today && (!internProfile.end_date || internProfile.end_date >= today));
    await Promise.all([
      database.from("intern_profiles").update({ status: active ? "active" : "pending" }).eq("id", internProfile.id),
      database.from("internship_applications").update({ onboarding_status: active ? "active" : "waiting_start" }).eq("applicant_user_id", user.id).not("converted_intern_id", "is", null),
    ]);
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Profil berhasil diperbarui!" };
}
