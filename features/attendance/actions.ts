"use server";

import { createSupabaseServerClient, createUteroAcademyClient, createSupabaseServiceRoleClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { getInternProfileId } from "@/features/daily-reports/queries";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkInSchema, checkOutSchema, reviewAttendanceSchema } from "./schemas";

function getTodayDateLocal() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type FormState = {
  ok: boolean;
  message: string;
  isOutOfRange?: boolean;
};

async function uploadSelfieBase64(supabase: any, userId: string, base64Data: string, type: 'in' | 'out'): Promise<string | null> {
  const base64Image = base64Data.split(";base64,").pop();
  if (!base64Image) return null;
  const today = getTodayDateLocal();
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

  // Geofencing Check
  const dbSrvIn = await createUteroAcademyServiceRoleClient();
  const { data: settingsIn } = await dbSrvIn
    .from("attendance_settings")
    .select("office_latitude, office_longitude, allow_geofencing, radius_meters")
    .eq("id", "00000000-0000-0000-0000-000000000001")
    .maybeSingle();

  let isOutOfRange = false;
  let outOfRangeReason = null;
  let outOfRangeProofUrl = null;

  if (settingsIn?.allow_geofencing) {
    const distance = getDistanceMeters(
      parsed.data.latitude,
      parsed.data.longitude,
      settingsIn.office_latitude || -7.9671,
      settingsIn.office_longitude || 112.6375
    );
    if (distance > (settingsIn.radius_meters || 100)) {
      isOutOfRange = true;
      const reason = formData.get("outOfRangeReason") as string | null;
      const proofFile = formData.get("outOfRangeProof") as File | null;
      
      if (!reason || reason.trim().length < 5) {
        return { 
          ok: false, 
          message: "Kamu di luar jangkauan Kantor. Mohon konfirmasi kegiatan luar jika ada.",
          isOutOfRange: true
        };
      }
      
      if (!proofFile || proofFile.size === 0) {
        return { 
          ok: false, 
          message: "Dokumen bukti kegiatan luar wajib diunggah.",
          isOutOfRange: true
        };
      }
      
      const serviceClient = createSupabaseServiceRoleClient();
      const ext = proofFile.name.split(".").pop() || "pdf";
      const filePath = user.id + "/proof_" + Date.now() + "." + ext;
      const arrayBuffer = await proofFile.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      const { error: uploadError } = await serviceClient.storage
        .from("avatars")
        .upload(filePath, buffer, { contentType: proofFile.type, upsert: true });
        
      if (uploadError) {
        return { ok: false, message: "Gagal mengunggah dokumen bukti kegiatan luar." };
      }
      const { data: { publicUrl } } = serviceClient.storage.from("avatars").getPublicUrl(filePath);
      outOfRangeProofUrl = publicUrl;
      outOfRangeReason = reason;
    }
  }

  const selfieUrl = await uploadSelfieBase64(supabase, user.id, selfieBase64, "in");
  if (!selfieUrl) return { ok: false, message: "Gagal mengunggah foto selfie." };
  const db = await createUteroAcademyClient();
  const today = getTodayDateLocal();
  const { error } = await db.from("attendances").insert({ 
    intern_id: internId, 
    attendance_date: today, 
    check_in_at: new Date().toISOString(), 
    check_in_latitude: parsed.data.latitude, 
    check_in_longitude: parsed.data.longitude, 
    check_in_wifi_ssid: parsed.data.wifiSsid || null, 
    check_in_selfie_path: selfieUrl, 
    status: isOutOfRange ? "manual_review" : "pending",
    is_out_of_range: isOutOfRange,
    out_of_range_reason: outOfRangeReason,
    out_of_range_proof_path: outOfRangeProofUrl
  });
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

  // Geofencing Check
  const dbSrvOut = await createUteroAcademyServiceRoleClient();
  const { data: settingsOut } = await dbSrvOut
    .from("attendance_settings")
    .select("office_latitude, office_longitude, allow_geofencing, radius_meters")
    .eq("id", "00000000-0000-0000-0000-000000000001")
    .maybeSingle();

  if (settingsOut?.allow_geofencing) {
    const distance = getDistanceMeters(
      parsed.data.latitude,
      parsed.data.longitude,
      settingsOut.office_latitude || -7.9671,
      settingsOut.office_longitude || 112.6375
    );
    if (distance > (settingsOut.radius_meters || 100)) {
      return { 
        ok: false, 
        message: "Absen ditolak. Anda berada di luar radius kantor (" + Math.round(distance) + "m > " + (settingsOut.radius_meters || 100) + "m)." 
      };
    }
  }

  const selfieUrl = await uploadSelfieBase64(supabase, user.id, selfieBase64, "out");
  if (!selfieUrl) return { ok: false, message: "Gagal mengunggah foto selfie." };
  const db = await createUteroAcademyClient();
  const today = getTodayDateLocal();
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

export async function submitPermitAction(_: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const internId = await getInternProfileId(user.id);
  if (!internId) return { ok: false, message: "Profil peserta tidak ditemukan." };

  const permitType = formData.get("permitType") as string;
  const reason = formData.get("reason") as string;
  const file = formData.get("certificate") as File | null;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;

  if (!permitType || !['permit', 'sick'].includes(permitType)) {
    return { ok: false, message: "Tipe izin tidak valid." };
  }
  
  if (!startDate || !endDate) {
    return { ok: false, message: "Tanggal mulai dan selesai wajib diisi." };
  }

  if (!reason || reason.trim().length < 5) {
    return { ok: false, message: "Alasan wajib diisi minimal 5 karakter." };
  }

  let certificateUrl = null;
  if (permitType === "sick") {
    if (!file || file.size === 0) {
      return { ok: false, message: "Keterangan Surat Dokter wajib diunggah untuk status Sakit." };
    }

    const serviceClient = createSupabaseServiceRoleClient();
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = user.id + "/sick_cert_" + Date.now() + "." + ext;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await serviceClient.storage
      .from("avatars")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      console.error("Gagal upload surat sakit:", uploadError);
      return { ok: false, message: "Gagal mengunggah surat dokter. Silakan coba lagi." };
    }

    const { data: { publicUrl } } = serviceClient.storage.from("avatars").getPublicUrl(filePath);
    certificateUrl = publicUrl;
  }

  const db = await createUteroAcademyServiceRoleClient();

  const { error } = await db.from("permits").insert({
    intern_id: internId,
    permit_type: permitType,
    start_date: startDate,
    end_date: endDate,
    reason: reason,
    attachment_path: certificateUrl,
    status: "pending"
  });

  if (error) {
    console.error("Gagal kirim izin:", error);
    return { ok: false, message: "Pengajuan izin gagal diproses. Silakan coba lagi." };
  }

  revalidatePath("/dashboard/intern/attendance");
  return { ok: true, message: "Pengajuan izin/sakit berhasil dikirim." };
}


export async function saveAttendanceSettingsAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const checkInTime = formData.get("checkInTime") as string;
  const checkOutTime = formData.get("checkOutTime") as string;
  const lateTolerance = formData.get("lateTolerance") as string;
  const monthlyTarget = formData.get("monthlyTarget") as string;
  const officeLatitude = formData.get("officeLatitude") as string;
  const officeLongitude = formData.get("officeLongitude") as string;
  const allowGeofencing = formData.get("allowGeofencing") === "true";
  const radiusMeters = formData.get("radiusMeters") as string;

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db.from("attendance_settings").upsert({
    id: "00000000-0000-0000-0000-000000000001",
    check_in_time: checkInTime || "08:00",
    check_out_time: checkOutTime || "17:00",
    late_tolerance_minutes: lateTolerance ? parseInt(lateTolerance) : 15,
    monthly_target_hours: monthlyTarget ? parseInt(monthlyTarget) : 120,
    office_latitude: officeLatitude ? parseFloat(officeLatitude) : -7.9671,
    office_longitude: officeLongitude ? parseFloat(officeLongitude) : 112.6375,
    allow_geofencing: allowGeofencing,
    radius_meters: radiusMeters ? parseInt(radiusMeters) : 100,
    updated_at: new Date().toISOString()
  });

  if (error) {
    console.error("Gagal simpan settings absensi:", error);
    throw new Error("Gagal menyimpan pengaturan absensi.");
  }

  revalidatePath("/dashboard/mentor/attendance");
}


export async function reviewPermitAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permitId = formData.get("permitId") as string;
  const status = formData.get("status") as string; // 'approved' | 'rejected'
  const endDate = formData.get("endDate") as string;

  if (!permitId || !status) throw new Error("Data tidak lengkap.");

  const db = await createUteroAcademyServiceRoleClient();

  // Ambil data permit
  const { data: permit } = await db.from("permits").select("*").eq("id", permitId).single();
  if (!permit) throw new Error("Permit tidak ditemukan.");

  // Update permit status and optionally endDate
  const newEndDate = endDate || permit.end_date;
  const { error: permitError } = await db.from("permits").update({
    status: status,
    end_date: newEndDate,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq("id", permitId);

  if (permitError) {
    console.error("Gagal review permit:", permitError);
    throw new Error("Gagal menyimpan review izin.");
  }

  // Generate attendances if approved
  if (status === "approved") {
    let current = new Date(permit.start_date);
    const end = new Date(newEndDate);
    const inserts = [];
    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10);
      inserts.push({
        intern_id: permit.intern_id,
        attendance_date: dateStr,
        attendance_type: permit.permit_type,
        permit_reason: permit.reason,
        sick_certificate_path: permit.attachment_path,
        status: "valid",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      });
      current.setDate(current.getDate() + 1);
    }

    if (inserts.length > 0) {
      // Upsert to handle conflict if intern already had an attendance row that day (e.g. pending check-in)
      const { error: insertError } = await db.from("attendances").upsert(inserts, {
        onConflict: "intern_id, attendance_date"
      });
      if (insertError) {
        console.error("Gagal buat absen dari permit:", insertError);
      }
    }
  }

  revalidatePath("/dashboard/mentor/attendance");
}
