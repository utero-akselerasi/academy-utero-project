"use server";

import { createUteroAcademyClient } from "@/lib/supabase/server";
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

  try {
    const db = await createUteroAcademyClient();
    const { error } = await db.from("internship_applications").insert({
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      school_name: parsed.data.schoolName,
      major: parsed.data.major,
      motivation: parsed.data.motivation,
      status: "submitted",
    });

    if (error) {
      return {
        ok: false,
        message: "Pendaftaran belum berhasil disimpan. Cek policy Supabase dan coba lagi.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "Koneksi Supabase belum siap. Isi env Supabase sebelum mencoba submit.",
    };
  }

  return {
    ok: true,
    message: "Pendaftaran berhasil dikirim. Tim Utero Academy akan melakukan review.",
  };
}
