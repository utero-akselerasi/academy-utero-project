"use server";

import { createSupabaseServerClient, createUteroAcademyClient } from "@/lib/supabase/server";
import { getInternProfileId } from "@/features/daily-reports/queries";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkInSchema, checkOutSchema, reviewAttendanceSchema } from "./schemas";

export type FormState = {
  ok: boolean;
  message: string;
};

async function uploadSelfieBase64(supabase: any, userId: string, base64Data: string, type: 'in' | 'out'): Promise<string | null> {
  const base64Image = base64Data.split(";base64,").pop();
  if (!base64Image) return null;
  const today = new Date().toISOString().slice(0, 10);
  const filePath = userId + "/attendance_" + today + "_" + type + "_" + Date.now() + ".jpg";
  const buffer = Buffer.from(base64Image, "base64");
  const { error } = await supabase.storage.from("avatars").upload(filePath, buffer, { contentType: "image/jpeg", upsert: true });
  if (error) {
    console.error("Gagal upload selfie base64:", error);
    return null;
  }
  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
  return publicUrl;
}

export async function checkInAction(_: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const internId = await getInternProfileId(user.id);
  if (!internId) return { ok: false, message: "Profil peserta tidak ditemukan." };
  const latStr = formData.get("latitude");
  const lngStr = formData.get("longitude");
  const selfieBase64 = formData.get("selfieBase64") as string;
  if (!latStr || !lngStr) return { ok: false, message: "Akses lokasi diperlukan untuk check-in." };
  if (!selfieBase64) return { ok: false, message: "Foto selfie wajib diambil." };
  const parsed = checkInSchema.safeParse({ latitude: Number(latStr), longitude: Number(lngStr), wifiSsid: formData.get("wifiSsid") || undefined });
  if (!parsed.success) return { ok: false, message: "Format koordinat lokasi tidak valid." };
  const selfieUrl = await uploadSelfieBase64(supabase, user.id, selfieBase64, "in");
  if (!selfieUrl) return { ok: false, message: "Gagal mengunggah foto selfie." };
  const db = await createUteroAcademyClient();
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await db.from("attendances").insert({ intern_id: internId, attendance_date: today, check_in_at: new Date().toISOString(), check_in_latitude: parsed.data.latitude, check_in_longitude: parsed.data.longitude, check_in_wifi_ssid: parsed.data.wifiSsid || null, check_in_selfie_path: selfieUrl, status: "pending" });
  if (error) {
    console.error("Gagal check-in:", error);
    return { ok: false, message: "Gagal check-in, mungkin sudah check-in hari ini." };
  }
  revalidatePath("/dashboard/intern/attendance");
  return { ok: true, message: "Check-in berhasil disimpan." };
}

export async function checkOutAction(_: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const internId = await getInternProfileId(user.id);
  if (!internId) return { ok: false, message: "Profil peserta tidak ditemukan." };
  const latStr = formData.get("latitude");
  const lngStr = formData.get("longitude");
  const selfieBase64 = formData.get("selfieBase64") as string;
  if (!latStr || !lngStr) return { ok: false, message: "Akses lokasi diperlukan untuk check-out." };
  if (!selfieBase64) return { ok: false, message: "Foto selfie wajib diambil." };
  const parsed = checkOutSchema.safeParse({ latitude: Number(latStr), longitude: Number(lngStr), wifiSsid: formData.get("wifiSsid") || undefined });
  if (!parsed.success) return { ok: false, message: "Format koordinat lokasi tidak valid." };
  const selfieUrl = await uploadSelfieBase64(supabase, user.id, selfieBase64, "out");
  if (!selfieUrl) return { ok: false, message: "Gagal mengunggah foto selfie." };
  const db = await createUteroAcademyClient();
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await db.from("attendances").update({ check_out_at: new Date().toISOString(), check_out_latitude: parsed.data.latitude, check_out_longitude: parsed.data.longitude, check_out_wifi_ssid: parsed.data.wifiSsid || null, check_out_selfie_path: selfieUrl, updated_at: new Date().toISOString() }).eq("intern_id", internId).eq("attendance_date", today);
  if (error) {
    console.log("Gagal check-out:", error);
    return { ok: false, message: "Gagal check-out. Harap check-in terlebih dahulu." };
  }
  revalidatePath("/dashboard/intern/attendance");
  return { ok: true, message: "Check-out berhasil disimpan." };
}

export async function reviewAttendanceAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const parsed = reviewAttendanceSchema.safeParse({ attendanceId: formData.get("attendanceId"), status: formData.get("status"), note: formData.get("note") });
  if (!parsed.success) throw new Error("Data review absensi tidak valid.");
  const db = await createUteroAcademyClient();
  const { error } = await db.from("attendances").update({ status: parsed.data.status, review_note: parsed.data.note || null, reviewed_by: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", parsed.data.attendanceId);
  if (error) {
    console.error("Gagal review absensi:", error);
    throw new Error("Gagal review absensi.");
  }
  revalidatePath("/dashboard/mentor/attendance");
}