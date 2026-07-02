"use server";

import { createSupabaseServiceRoleClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { z } from "zod";

const registrationSchema = z.object({
  fullName: z.string().min(3, "Nama lengkap minimal 3 karakter."),
  email: z.string().email("Email tidak valid."),
  phone: z.string().min(8, "Nomor WhatsApp minimal 8 karakter."),
  schoolName: z.string().min(2, "Nama sekolah wajib diisi."),
  major: z.string().min(2, "Jurusan wajib diisi."),
  motivation: z.string().min(20, "Motivasi minimal 20 karakter."),
});

export type RegistrationState = {
  ok: boolean;
  message: string;
};

export async function submitRegistrationAction(
  _: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const parsed = registrationSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    schoolName: formData.get("schoolName"),
    major: formData.get("major"),
    motivation: formData.get("motivation"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Data pendaftaran tidak valid.",
    };
  }

  const cvFile = formData.get("cv") as File | null;
  const portfolioFile = formData.get("portfolio") as File | null;

  if (!cvFile || cvFile.size === 0) {
    return { ok: false, message: "Berkas CV wajib diunggah." };
  }

  try {
    const supabase = createSupabaseServiceRoleClient();
    const db = await createUteroAcademyServiceRoleClient();

    // 1. Upload CV
    const cvExt = cvFile.name.split(".").pop() || "pdf";
    const cvPath = "cv/" + Date.now() + "_" + Math.random().toString(36).substring(2, 8) + "." + cvExt;
    const cvBuffer = new Uint8Array(await cvFile.arrayBuffer());
    
    const { error: cvUploadError } = await supabase.storage
      .from("avatars")
      .upload(cvPath, cvBuffer, { contentType: cvFile.type, upsert: true });

    if (cvUploadError) {
      console.error("Gagal upload CV:", cvUploadError);
      return { ok: false, message: "Gagal mengunggah berkas CV. Silakan coba lagi." };
    }

    const { data: { publicUrl: cvPublicUrl } } = supabase.storage.from("avatars").getPublicUrl(cvPath);

    // 2. Upload Portfolio (opsional)
    let portfolioPublicUrl = null;
    if (portfolioFile && portfolioFile.size > 0) {
      const portExt = portfolioFile.name.split(".").pop() || "pdf";
      const portPath = "portfolio/" + Date.now() + "_" + Math.random().toString(36).substring(2, 8) + "." + portExt;
      const portBuffer = new Uint8Array(await portfolioFile.arrayBuffer());

      const { error: portUploadError } = await supabase.storage
        .from("avatars")
        .upload(portPath, portBuffer, { contentType: portfolioFile.type, upsert: true });

      if (portUploadError) {
        console.error("Gagal upload Portfolio:", portUploadError);
      } else {
        const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(portPath);
        portfolioPublicUrl = publicUrl;
      }
    }

    // 3. Insert Application
    const { error } = await db.from("internship_applications").insert({
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      school_name: parsed.data.schoolName,
      major: parsed.data.major,
      motivation: parsed.data.motivation,
      cv_path: cvPublicUrl,
      portfolio_path: portfolioPublicUrl,
      status: "submitted",
    });

    if (error) {
      console.error("Gagal submit pendaftaran:", error);
      return {
        ok: false,
        message: "Pendaftaran belum berhasil disimpan. Detail: " + error.message,
      };
    }
  } catch (error) {
    console.error("Koneksi Supabase belum siap:", error);
    return {
      ok: false,
      message: "Terjadi kesalahan koneksi server. Coba lagi nanti.",
    };
  }

  return {
    ok: true,
    message: "Pendaftaran berhasil dikirim. Tim Utero Academy akan melakukan review.",
  };
}
