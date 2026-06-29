"use server";

import { createSupabaseServerClient, createUteroAcademyClient } from "@/lib/supabase/server";
import { getInternProfileId, getMentorProfileId } from "@/features/daily-reports/queries";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ProfileFormState = {
  ok: boolean;
  message: string;
};

export async function updateProfileAction(_: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const fullName = formData.get("fullName");
  const phone = formData.get("phone");
  const avatarFile = formData.get("avatar") as File;
  if (!fullName) return { ok: false, message: "Nama lengkap wajib diisi." };
  const db = await createUteroAcademyClient();
  let avatarUrl = null;
  if (avatarFile && avatarFile.size > 0) {
    const ext = avatarFile.name.split(".").pop() || "jpg";
    const filePath = user.id + "/avatar_" + Date.now() + "." + ext;
    const arrayBuffer = await avatarFile.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const { error: uploadErr } = await supabase.storage.from("avatars").upload(filePath, buffer, { contentType: avatarFile.type, upsert: true });
    if (!uploadErr) {
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
      avatarUrl = publicUrl;
    }
  }
  const updateData: any = { full_name: fullName, phone: phone || null, updated_at: new Date().toISOString() };
  if (avatarUrl) updateData.avatar_path = avatarUrl;
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